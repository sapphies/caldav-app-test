/**
 * Lightweight iCal VTODO parser and generator
 * Replaces ical.js (~266KB) with minimal implementation for VTODO support
 */

import { Task, Priority, Subtask, Reminder } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import * as taskData from '@/lib/taskData';
import { createLogger } from '@/lib/logger';

const log = createLogger('iCal', '#22c55e');

// Apple epoch: January 1, 2001 00:00:00 GMT in milliseconds since Unix epoch
// Used for X-APPLE-SORT-ORDER which stores seconds since Apple epoch
export const APPLE_EPOCH = 978307200000;

// Convert Unix timestamp (milliseconds) to Apple epoch (seconds)
export function toAppleEpoch(timestamp: number): number {
  return Math.floor((timestamp - APPLE_EPOCH) / 1000);
}

// Convert Apple epoch (seconds) to Unix timestamp (milliseconds)
export function fromAppleEpoch(appleSeconds: number): number {
  return appleSeconds * 1000 + APPLE_EPOCH;
}

// Priority mapping: iCalendar uses 1-9 (1 = highest, 9 = lowest)
// We map: high = 1, medium = 5, low = 9, none = 0
const priorityToIcal: Record<Priority, number> = {
  high: 1,
  medium: 5,
  low: 9,
  none: 0,
};

const icalToPriority = (priority: number): Priority => {
  if (priority === 0) return 'none';
  if (priority >= 1 && priority <= 4) return 'high';
  if (priority === 5) return 'medium';
  return 'low';
};

/**
 * Format a Date as iCalendar datetime (UTC)
 * Format: YYYYMMDDTHHMMSSZ
 */
function formatICalDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Format a Date as iCalendar date (no time component)
 * Format: YYYYMMDD (VALUE=DATE)
 */
function formatICalDateOnly(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  // Use local date parts for all-day dates
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate())
  );
}

/**
 * Parse an iCalendar datetime string to Date
 * Supports: YYYYMMDDTHHMMSSZ, YYYYMMDDTHHMMSS, YYYYMMDD
 */
function parseICalDate(value: string): Date | undefined {
  if (!value) return undefined;
  
  // Remove any parameters before the value (e.g., TZID=...)
  const cleanValue = value.trim();
  
  // UTC format: 20231225T120000Z
  if (cleanValue.endsWith('Z')) {
    const match = cleanValue.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      ));
    }
  }
  
  // Local datetime: 20231225T120000
  const dtMatch = cleanValue.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (dtMatch) {
    const [, year, month, day, hour, minute, second] = dtMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }
  
  // Date only: 20231225
  const dateMatch = cleanValue.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return undefined;
}

/**
 * Escape text for iCalendar format
 * Escapes: backslash, semicolon, comma, newline
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Unescape iCalendar text
 */
function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Fold long lines according to RFC 5545 (max 75 octets per line)
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;
  
  const lines: string[] = [];
  let remaining = line;
  
  // First line can be up to 75 chars
  lines.push(remaining.slice(0, maxLength));
  remaining = remaining.slice(maxLength);
  
  // Continuation lines start with space and can have 74 more chars
  while (remaining.length > 0) {
    lines.push(' ' + remaining.slice(0, maxLength - 1));
    remaining = remaining.slice(maxLength - 1);
  }
  
  return lines.join('\r\n');
}

/**
 * Unfold iCalendar content lines (join lines that start with space/tab)
 */
function unfoldLines(content: string): string {
  // Normalize line endings
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');
}

interface ICalProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/**
 * Parse a single iCalendar property line
 * Format: NAME;PARAM=value:VALUE or NAME:VALUE
 */
function parseProperty(line: string): ICalProperty | null {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return null;
  
  const header = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  
  // Parse name and parameters
  const parts = header.split(';');
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  
  for (let i = 1; i < parts.length; i++) {
    const paramPart = parts[i];
    const eqIndex = paramPart.indexOf('=');
    if (eqIndex !== -1) {
      const paramName = paramPart.slice(0, eqIndex).toUpperCase();
      let paramValue = paramPart.slice(eqIndex + 1);
      // Remove quotes if present
      if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
        paramValue = paramValue.slice(1, -1);
      }
      params[paramName] = paramValue;
    }
  }
  
  return { name, params, value };
}

interface ParsedVAlarm {
  action?: string;
  trigger?: Date;
  description?: string;
}

interface ParsedVTodo {
  uid?: string;
  summary?: string;
  description?: string;
  status?: string;
  priority?: number;
  categories?: string[];
  dtstart?: Date;
  dtstartAllDay?: boolean;
  due?: Date;
  dueAllDay?: boolean;
  completed?: Date;
  created?: Date;
  lastModified?: Date;
  sortOrder?: number;
  subtasksJson?: string;
  isCollapsed?: boolean;
  parentUid?: string;
  alarms?: ParsedVAlarm[];
}

/**
 * Parse VALARM content into structured data
 */
function parseVAlarm(valarmContent: string): ParsedVAlarm {
  const result: ParsedVAlarm = {};
  const lines = unfoldLines(valarmContent).split('\n');
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('BEGIN:') || line.startsWith('END:')) {
      continue;
    }
    
    const prop = parseProperty(line);
    if (!prop) continue;
    
    switch (prop.name) {
      case 'ACTION':
        result.action = prop.value.toUpperCase();
        break;
      case 'DESCRIPTION':
        result.description = unescapeICalText(prop.value);
        break;
      case 'TRIGGER':
        // Support both VALUE=DATE-TIME and relative triggers
        if (prop.params['VALUE'] === 'DATE-TIME') {
          result.trigger = parseICalDate(prop.value);
        } else if (prop.value.startsWith('P') || prop.value.startsWith('-P')) {
          // Relative trigger (e.g., -PT15M = 15 minutes before)
          // For now, we skip relative triggers since we use absolute times
        } else {
          // Try parsing as absolute time
          result.trigger = parseICalDate(prop.value);
        }
        break;
    }
  }
  
  return result;
}

/**
 * Extract VALARM blocks from VTODO content
 */
function extractVAlarms(vtodoContent: string): string[] {
  const alarms: string[] = [];
  const content = unfoldLines(vtodoContent);
  const lines = content.split('\n');
  
  let inAlarm = false;
  let currentAlarm: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim().toUpperCase();
    
    if (trimmed === 'BEGIN:VALARM') {
      inAlarm = true;
      currentAlarm = [];
    } else if (trimmed === 'END:VALARM') {
      if (inAlarm) {
        alarms.push(currentAlarm.join('\n'));
        currentAlarm = [];
      }
      inAlarm = false;
    } else if (inAlarm) {
      currentAlarm.push(line);
    }
  }
  
  return alarms;
}

/**
 * Parse VTODO content into structured data
 */
function parseVTodo(vtodoContent: string): ParsedVTodo {
  const result: ParsedVTodo = {};
  const lines = unfoldLines(vtodoContent).split('\n');

  // Extract and parse VALARMs first
  const alarmContents = extractVAlarms(vtodoContent);
  if (alarmContents.length > 0) {
    result.alarms = alarmContents.map(parseVAlarm).filter(a => a.trigger);
  }
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('BEGIN:') || line.startsWith('END:')) {
      continue;
    }
    
    const prop = parseProperty(line);
    if (!prop) continue;
    
    switch (prop.name) {
      case 'UID':
        result.uid = prop.value;
        break;
      case 'SUMMARY':
        result.summary = unescapeICalText(prop.value);
        break;
      case 'DESCRIPTION':
        result.description = unescapeICalText(prop.value);
        break;
      case 'STATUS':
        result.status = prop.value.toUpperCase();
        break;
      case 'PRIORITY':
        result.priority = parseInt(prop.value, 10) || 0;
        break;
      case 'CATEGORIES':
        // Categories can be comma-separated
        result.categories = prop.value.split(',').map(c => unescapeICalText(c.trim()));
        break;
      case 'DTSTART':
        result.dtstart = parseICalDate(prop.value);
        // Check if it's an all-day date (VALUE=DATE parameter)
        result.dtstartAllDay = prop.params['VALUE'] === 'DATE';
        break;
      case 'DUE':
        result.due = parseICalDate(prop.value);
        // Check if it's an all-day date (VALUE=DATE parameter)
        result.dueAllDay = prop.params['VALUE'] === 'DATE';
        break;
      case 'COMPLETED':
        result.completed = parseICalDate(prop.value);
        break;
      case 'CREATED':
        result.created = parseICalDate(prop.value);
        break;
      case 'LAST-MODIFIED':
        result.lastModified = parseICalDate(prop.value);
        break;
      case 'X-APPLE-SORT-ORDER':
        result.sortOrder = parseInt(prop.value, 10);
        break;
      case 'X-CALDAV-TASKS-SUBTASKS':
        result.subtasksJson = prop.value;
        break;
      case 'X-APPLE-COLLAPSED':
        result.isCollapsed = prop.value === '1';
        break;
      case 'RELATED-TO':
        // Only use PARENT relationship
        const relType = prop.params['RELTYPE'];
        if (!relType || relType.toUpperCase() === 'PARENT') {
          result.parentUid = prop.value;
        }
        break;
    }
  }
  
  return result;
}

/**
 * Extract VTODO blocks from iCalendar content
 */
function extractVTodos(icalContent: string): string[] {
  const vtodos: string[] = [];
  const content = unfoldLines(icalContent);
  const lines = content.split('\n');
  
  let inVTodo = false;
  let currentVTodo: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim().toUpperCase();
    
    if (trimmed === 'BEGIN:VTODO') {
      inVTodo = true;
      currentVTodo = [];
    } else if (trimmed === 'END:VTODO') {
      if (inVTodo) {
        vtodos.push(currentVTodo.join('\n'));
        currentVTodo = [];
      }
      inVTodo = false;
    } else if (inVTodo) {
      currentVTodo.push(line);
    }
  }
  
  return vtodos;
}

/**
 * Generate a VALARM component as string
 */
function generateVAlarm(reminder: Reminder): string {
  const lines: string[] = [];
  
  lines.push('BEGIN:VALARM');
  lines.push('ACTION:DISPLAY');
  lines.push(`TRIGGER;VALUE=DATE-TIME:${formatICalDate(new Date(reminder.trigger))}`);
  lines.push('END:VALARM');
  
  return lines.join('\r\n');
}

/**
 * Generate a VTODO component as string
 */
function generateVTodo(task: Task): string {
  const lines: string[] = [];
  
  lines.push('BEGIN:VTODO');
  lines.push(`UID:${task.uid}`);
  lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
  lines.push(`CREATED:${formatICalDate(new Date(task.createdAt))}`);
  lines.push(`LAST-MODIFIED:${formatICalDate(new Date(task.modifiedAt))}`);
  lines.push(`SUMMARY:${escapeICalText(task.title)}`);
  
  if (task.description) {
    lines.push(`DESCRIPTION:${escapeICalText(task.description)}`);
  }
  
  lines.push(`STATUS:${task.completed ? 'COMPLETED' : 'NEEDS-ACTION'}`);
  
  if (task.completed && task.completedAt) {
    lines.push(`COMPLETED:${formatICalDate(new Date(task.completedAt))}`);
  }
  
  lines.push(`PRIORITY:${priorityToIcal[task.priority]}`);
  
  if (task.startDate) {
    if (task.startDateAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatICalDateOnly(new Date(task.startDate))}`);
    } else {
      lines.push(`DTSTART:${formatICalDate(new Date(task.startDate))}`);
    }
  }
  
  if (task.dueDate) {
    if (task.dueDateAllDay) {
      lines.push(`DUE;VALUE=DATE:${formatICalDateOnly(new Date(task.dueDate))}`);
    } else {
      lines.push(`DUE:${formatICalDate(new Date(task.dueDate))}`);
    }
  }
  
  lines.push(`X-APPLE-SORT-ORDER:${task.sortOrder}`);
  
  // Tags as CATEGORIES
  if (task.tags && task.tags.length > 0) {
    const tags = taskData.getTags();
    const tagNames = task.tags
      .map(tagId => tags.find(t => t.id === tagId)?.name)
      .filter((name): name is string => Boolean(name));
    
    if (tagNames.length > 0) {
      const escaped = tagNames.map(n => escapeICalText(n));
      lines.push(`CATEGORIES:${escaped.join(',')}`);
    }
  }
  
  // Parent relationship
  if (task.parentUid) {
    lines.push(`RELATED-TO;RELTYPE=PARENT:${task.parentUid}`);
  }
  
  // Collapsed state
  if (task.isCollapsed) {
    lines.push('X-APPLE-COLLAPSED:1');
  }
  
  // Legacy subtasks (app-specific)
  if (task.subtasks.length > 0) {
    const subtasksJson = JSON.stringify(task.subtasks);
    lines.push(`X-CALDAV-TASKS-SUBTASKS:${subtasksJson}`);
  }

  // Reminders as VALARMs
  if (task.reminders && task.reminders.length > 0) {
    for (const reminder of task.reminders) {
      lines.push(generateVAlarm(reminder));
    }
  }
  
  lines.push('END:VTODO');
  
  // Fold long lines
  return lines.map(foldLine).join('\r\n');
}

/**
 * Generate a complete VCALENDAR with VTODOs
 */
function generateVCalendar(vtodos: string[]): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//caldav-tasks//EN');
  
  for (const vtodo of vtodos) {
    lines.push(vtodo);
  }
  
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

// ============================================================================
// Public API - Drop-in replacements for ical.js functions
// ============================================================================

/**
 * Convert a Task to iCalendar VTODO format
 */
export function taskToVTodo(task: Task): string {
  const vtodo = generateVTodo(task);
  return generateVCalendar([vtodo]);
}

/**
 * Parse iCalendar string and convert to Task
 */
export function vtodoToTask(
  icalString: string,
  accountId: string,
  calendarId: string,
  href?: string,
  etag?: string
): Task | null {
  try {
    const vtodos = extractVTodos(icalString);
    if (vtodos.length === 0) return null;
    
    const parsed = parseVTodo(vtodos[0]);
    
    // Parse subtasks
    let subtasks: Subtask[] = [];
    if (parsed.subtasksJson) {
      try {
        subtasks = JSON.parse(parsed.subtasksJson);
      } catch {
        subtasks = [];
      }
    }

    // Parse reminders from alarms
    let reminders: Reminder[] | undefined;
    if (parsed.alarms && parsed.alarms.length > 0) {
      reminders = parsed.alarms
        .filter(a => a.trigger)
        .map(a => ({
          id: uuidv4(),
          trigger: a.trigger!,
        }));
    }
    
    // Calculate sort order
    const createdDate = parsed.created || new Date();
    let sortOrder: number;
    if (parsed.sortOrder !== undefined && !isNaN(parsed.sortOrder)) {
      sortOrder = parsed.sortOrder;
    } else {
      sortOrder = toAppleEpoch(createdDate.getTime());
    }
    
    const task: Task = {
      id: uuidv4(),
      uid: parsed.uid || uuidv4(),
      etag,
      href,
      title: parsed.summary || 'Untitled Task',
      description: parsed.description || '',
      completed: parsed.status === 'COMPLETED',
      completedAt: parsed.completed,
      priority: icalToPriority(parsed.priority || 0),
      categoryId: parsed.categories?.join(',') || undefined,
      startDate: parsed.dtstart,
      startDateAllDay: parsed.dtstartAllDay,
      dueDate: parsed.due,
      dueDateAllDay: parsed.dueAllDay,
      createdAt: createdDate,
      modifiedAt: parsed.lastModified || new Date(),
      subtasks,
      parentUid: parsed.parentUid,
      isCollapsed: parsed.isCollapsed || false,
      sortOrder,
      accountId,
      calendarId,
      synced: true,
      reminders,
    };
    
    return task;
  } catch (error) {
    log.error('Error parsing VTODO:', error);
    return null;
  }
}

/**
 * Generate a unique iCalendar UID
 */
export function generateICalUid(): string {
  return `${uuidv4()}@caldav-tasks`;
}

/**
 * Export a single task as iCalendar format with all its child tasks
 */
export function exportTaskAsIcs(task: Task, childTasks: Task[] = []): string {
  const vtodos: string[] = [];
  vtodos.push(generateVTodo(task));
  
  for (const childTask of childTasks) {
    vtodos.push(generateVTodo(childTask));
  }
  
  return generateVCalendar(vtodos);
}

/**
 * Export multiple tasks as iCalendar format
 */
export function exportTasksAsIcs(tasks: Task[]): string {
  const vtodos = tasks.map(task => generateVTodo(task));
  return generateVCalendar(vtodos);
}

/**
 * Export tasks as JSON for backup/export
 */
export function exportTasksAsJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

/**
 * Export tasks as Markdown checklist format
 */
export function exportTasksAsMarkdown(tasks: Task[], level: number = 0): string {
  let markdown = '';
  
  for (const task of tasks) {
    const indent = '  '.repeat(level);
    const checkbox = task.completed ? '[x]' : '[ ]';
    let line = `${indent}${checkbox} ${task.title}`;
    
    // Add metadata if present
    const metadata: string[] = [];
    if (task.priority !== 'none') {
      metadata.push(`Priority: ${task.priority}`);
    }
    if (task.dueDate) {
      metadata.push(`Due: ${new Date(task.dueDate).toLocaleDateString()}`);
    }
    if (task.categoryId) {
      metadata.push(`Category: ${task.categoryId}`);
    }
    
    if (metadata.length > 0) {
      line += ` (${metadata.join(', ')})`;
    }
    
    if (task.description) {
      line += `\n${indent}  > ${task.description.replace(/\n/g, `\n${indent}  > `)}`;
    }
    
    markdown += line + '\n';
  }
  
  return markdown;
}

/**
 * Export tasks as CSV format
 */
export function exportTasksAsCsv(tasks: Task[]): string {
  const headers = ['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Start Date', 'Category', 'Created', 'Modified'];
  const rows = tasks.map(task => [
    `"${task.title.replace(/"/g, '""')}"`,
    `"${task.description.replace(/"/g, '""')}"`,
    task.completed ? 'Completed' : 'Pending',
    task.priority,
    task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '',
    task.startDate ? new Date(task.startDate).toLocaleDateString() : '',
    task.categoryId || '',
    new Date(task.createdAt).toLocaleDateString(),
    new Date(task.modifiedAt).toLocaleDateString(),
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Parse an ICS file and extract all tasks (VTODOs)
 * Returns parsed tasks without accountId/calendarId - caller must assign them
 */
export function parseIcsFile(icsContent: string): Partial<Task>[] {
  try {
    const vtodos = extractVTodos(icsContent);
    const tasks: Partial<Task>[] = [];
    
    for (const vtodoContent of vtodos) {
      const parsed = parseVTodo(vtodoContent);
      
      // Parse subtasks
      let subtasks: Subtask[] = [];
      if (parsed.subtasksJson) {
        try {
          subtasks = JSON.parse(parsed.subtasksJson);
        } catch {
          subtasks = [];
        }
      }

      // Parse reminders from alarms
      let reminders: Reminder[] | undefined;
      if (parsed.alarms && parsed.alarms.length > 0) {
        reminders = parsed.alarms
          .filter(a => a.trigger)
          .map(a => ({
            id: uuidv4(),
            trigger: a.trigger!,
          }));
      }
      
      // Calculate sort order
      const createdDate = parsed.created || new Date();
      let sortOrder: number;
      if (parsed.sortOrder !== undefined && !isNaN(parsed.sortOrder)) {
        sortOrder = parsed.sortOrder;
      } else {
        sortOrder = toAppleEpoch(createdDate.getTime());
      }
      
      tasks.push({
        id: uuidv4(),
        uid: parsed.uid || uuidv4(),
        title: parsed.summary || 'Untitled Task',
        description: parsed.description || '',
        completed: parsed.status === 'COMPLETED',
        completedAt: parsed.completed,
        priority: icalToPriority(parsed.priority || 0),
        categoryId: parsed.categories?.join(',') || undefined,
        startDate: parsed.dtstart,
        startDateAllDay: parsed.dtstartAllDay,
        dueDate: parsed.due,
        dueDateAllDay: parsed.dueAllDay,
        createdAt: createdDate,
        modifiedAt: parsed.lastModified || new Date(),
        subtasks,
        parentUid: parsed.parentUid,
        isCollapsed: parsed.isCollapsed || false,
        sortOrder,
        synced: false,
        reminders,
      });
    }
    
    return tasks;
  } catch (error) {
    log.error('Error parsing ICS file:', error);
    return [];
  }
}

/**
 * Parse a JSON file containing tasks (exported from this app)
 */
export function parseJsonTasksFile(jsonContent: string): Partial<Task>[] {
  try {
    const data = JSON.parse(jsonContent);
    
    // Handle array of tasks directly
    if (Array.isArray(data)) {
      return data.map(task => ({
        ...task,
        id: uuidv4(), // Always generate new IDs
        synced: false,
      }));
    }
    
    return [];
  } catch (error) {
    log.error('Error parsing JSON tasks file:', error);
    return [];
  }
}
