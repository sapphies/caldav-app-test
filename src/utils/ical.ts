import ICAL from 'ical.js';
import { Task, Priority, Subtask } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useTaskStore } from '@/store/taskStore';

// apple epoch: January 1, 2001 00:00:00 GMT in milliseconds since Unix epoch
// used for X-APPLE-SORT-ORDER which stores seconds since Apple epoch
export const APPLE_EPOCH = 978307200000;

// convert Unix timestamp (milliseconds) to Apple epoch (seconds)
export function toAppleEpoch(timestamp: number): number {
  return Math.floor((timestamp - APPLE_EPOCH) / 1000);
}

// convert Apple epoch (seconds) to Unix timestamp (milliseconds)
export function fromAppleEpoch(appleSeconds: number): number {
  return appleSeconds * 1000 + APPLE_EPOCH;
}

// priority mapping: iCalendar uses 1-9 (1 = highest, 9 = lowest)
// we map: high = 1, medium = 5, low = 9, none = 0
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

export function taskToVTodo(task: Task): string {
  const comp = new ICAL.Component(['vcalendar', [], []]);
  comp.updatePropertyWithValue('version', '2.0');
  comp.updatePropertyWithValue('prodid', '-//CalDAV Tasks//EN');

  const vtodo = new ICAL.Component('vtodo');
  
  // required fields
  vtodo.updatePropertyWithValue('uid', task.uid);
  vtodo.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vtodo.updatePropertyWithValue('created', ICAL.Time.fromJSDate(new Date(task.createdAt)));
  vtodo.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(new Date(task.modifiedAt)));

  // title and description
  vtodo.updatePropertyWithValue('summary', task.title);
  if (task.description) {
    vtodo.updatePropertyWithValue('description', task.description);
  }

  // status
  vtodo.updatePropertyWithValue('status', task.completed ? 'COMPLETED' : 'NEEDS-ACTION');
  if (task.completed && task.completedAt) {
    vtodo.updatePropertyWithValue('completed', ICAL.Time.fromJSDate(new Date(task.completedAt)));
  }

  // priority
  vtodo.updatePropertyWithValue('priority', priorityToIcal[task.priority]);

  // dates
  if (task.startDate) {
    vtodo.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(new Date(task.startDate)));
  }
  if (task.dueDate) {
    vtodo.updatePropertyWithValue('due', ICAL.Time.fromJSDate(new Date(task.dueDate)));
  }

  // x-apple-sort-order for manual sorting (compatible with Apple Reminders, Nextcloud Tasks)
  vtodo.updatePropertyWithValue('x-apple-sort-order', task.sortOrder.toString());

  // tags - stored as CATEGORIES for CalDAV compatibility
  // Convert tag IDs to tag names
  if (task.tags && task.tags.length > 0) {
    const tags = useTaskStore.getState().tags;
    const tagNames = task.tags
      .map(tagId => tags.find(t => t.id === tagId)?.name)
      .filter((name): name is string => Boolean(name));
    
    if (tagNames.length > 0) {
      // Use Property with setValues to properly encode multiple categories
      // This creates CATEGORIES:tag1,tag2 where each is a separate value
      // rather than a single value "tag1,tag2"
      const categoriesProp = new ICAL.Property('categories', vtodo);
      categoriesProp.setValues(tagNames);
      vtodo.addProperty(categoriesProp);
    }
  }

  // parent-child relationship using RELATED-TO (CalDAV standard)
  if (task.parentUid) {
    // add RELATED-TO property with RELTYPE=PARENT parameter
    // this creates a parent-child relationship in CalDAV
    const relatedTo = new ICAL.Property('related-to', vtodo);
    relatedTo.setValue(task.parentUid);
    relatedTo.setParameter('reltype', 'PARENT');
    vtodo.addProperty(relatedTo);
  }

  // not a caldav standard
  if (task.isCollapsed) {
    vtodo.updatePropertyWithValue('x-apple-collapsed', '1');
  }

  // not a caldav standard. only used in our app for exporting / importing
  if (task.subtasks.length > 0) {
    const subtasksJson = JSON.stringify(task.subtasks);
    vtodo.updatePropertyWithValue('x-caldav-tasks-subtasks', subtasksJson);
  }

  comp.addSubcomponent(vtodo);
  return comp.toString();
}

export function vtodoToTask(
  icalString: string,
  accountId: string,
  calendarId: string,
  href?: string,
  etag?: string
): Task | null {
  try {
    const jcalData = ICAL.parse(icalString);
    const comp = new ICAL.Component(jcalData);
    const vtodo = comp.getFirstSubcomponent('vtodo');

    if (!vtodo) return null;

    const uid = vtodo.getFirstPropertyValue('uid') as string;
    const summary = vtodo.getFirstPropertyValue('summary') as string;
    const description = vtodo.getFirstPropertyValue('description') as string;
    const status = vtodo.getFirstPropertyValue('status') as string;
    const priority = vtodo.getFirstPropertyValue('priority') as number;
    
    // CATEGORIES can have multiple values - get all of them
    // Some clients use comma-separated values, others use multiple values
    let categories: string | undefined;
    const categoriesProp = vtodo.getFirstProperty('categories');
    if (categoriesProp) {
      const values = categoriesProp.getValues() as string[];
      categories = values.join(',');
      console.log('[iCal] Parsed CATEGORIES:', categories, 'from values:', values);
    }
    
    const sortOrder = vtodo.getFirstPropertyValue('x-apple-sort-order');
    const subtasksJson = vtodo.getFirstPropertyValue('x-caldav-tasks-subtasks') as string;
    const isCollapsed = vtodo.getFirstPropertyValue('x-apple-collapsed') === '1';

    // parse RELATED-TO property for parent-child relationships
    let parentUid: string | undefined;
    const relatedToProps = vtodo.getAllProperties('related-to');
    for (const prop of relatedToProps) {
      const relType = prop.getParameter('reltype');
      // if RELTYPE is PARENT or not specified, this is the parent relationship
      if (!relType || relType.toUpperCase() === 'PARENT') {
        parentUid = prop.getFirstValue() as string;
        break;
      }
    }

    // parse dates
    const created = vtodo.getFirstPropertyValue('created');
    const lastModified = vtodo.getFirstPropertyValue('last-modified');
    const dtstart = vtodo.getFirstPropertyValue('dtstart');
    const due = vtodo.getFirstPropertyValue('due');
    const completed = vtodo.getFirstPropertyValue('completed');

    // parse subtasks
    let subtasks: Subtask[] = [];
    if (subtasksJson) {
      try {
        subtasks = JSON.parse(subtasksJson);
      } catch {
        subtasks = [];
      }
    }

    // parse sort order (X-APPLE-SORT-ORDER)
    // this is stored as seconds since Apple epoch (Jan 1, 2001)
    // if not present, use creation date converted to Apple epoch format
    const createdDate = created ? (created as ICAL.Time).toJSDate() : new Date();
    let parsedSortOrder: number;
    if (sortOrder !== null && sortOrder !== undefined) {
      parsedSortOrder = parseInt(sortOrder as string, 10);
      if (isNaN(parsedSortOrder)) {
        parsedSortOrder = toAppleEpoch(createdDate.getTime());
      }
    } else {
      parsedSortOrder = toAppleEpoch(createdDate.getTime());
    }

    const task: Task = {
      id: uuidv4(),
      uid: uid || uuidv4(),
      etag,
      href,
      title: summary || 'Untitled Task',
      description: description || '',
      completed: status === 'COMPLETED',
      completedAt: completed ? (completed as ICAL.Time).toJSDate() : undefined,
      priority: icalToPriority(priority || 0),
      categoryId: categories || undefined,
      startDate: dtstart ? (dtstart as ICAL.Time).toJSDate() : undefined,
      dueDate: due ? (due as ICAL.Time).toJSDate() : undefined,
      createdAt: createdDate,
      modifiedAt: lastModified ? (lastModified as ICAL.Time).toJSDate() : new Date(),
      subtasks,
      parentUid,
      isCollapsed,
      sortOrder: parsedSortOrder,
      accountId,
      calendarId,
      synced: true,
    };

    return task;
  } catch (error) {
    console.error('Error parsing VTODO:', error);
    return null;
  }
}

export function generateICalUid(): string {
  return `${uuidv4()}@caldav-tasks`;
}

/**
 * export a single task as iCalendar format with all its subtasks
 */
export function exportTaskAsIcs(task: Task, childTasks: Task[] = []): string {
  const comp = new ICAL.Component(['vcalendar', [], []]);
  comp.updatePropertyWithValue('version', '2.0');
  comp.updatePropertyWithValue('prodid', '-//CalDAV Tasks//EN');
  
  // add main task
  const mainVtodo = buildVtodo(task);
  comp.addSubcomponent(mainVtodo);
  
  // add child tasks (subtasks in hierarchy)
  for (const childTask of childTasks) {
    const childVtodo = buildVtodo(childTask);
    comp.addSubcomponent(childVtodo);
  }
  
  return comp.toString();
}

/**
 * export multiple tasks as iCalendar format
 */
export function exportTasksAsIcs(tasks: Task[]): string {
  const comp = new ICAL.Component(['vcalendar', [], []]);
  comp.updatePropertyWithValue('version', '2.0');
  comp.updatePropertyWithValue('prodid', '-//CalDAV Tasks//EN');
  
  for (const task of tasks) {
    const vtodo = buildVtodo(task);
    comp.addSubcomponent(vtodo);
  }
  
  return comp.toString();
}

/**
 * export tasks as JSON for backup/export
 */
export function exportTasksAsJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

/**
 * export tasks as Markdown checklist format
 */
export function exportTasksAsMarkdown(tasks: Task[], level: number = 0): string {
  let markdown = '';
  
  for (const task of tasks) {
    const indent = '  '.repeat(level);
    const checkbox = task.completed ? '[x]' : '[ ]';
    let line = `${indent}${checkbox} ${task.title}`;
    
    // add metadata if present
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
 * export tasks as CSV format
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
 * parse an ICS file and extract all tasks (VTODOs)
 * returns parsed tasks without accountId/calendarId - caller must assign them
 */
export function parseIcsFile(icsContent: string): Partial<Task>[] {
  try {
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vtodos = (comp as any).getAllSubcomponents('vtodo') as ICAL.Component[];
    
    const tasks: Partial<Task>[] = [];
    
    for (const vtodo of vtodos) {
      const uid = vtodo.getFirstPropertyValue('uid') as string;
      const summary = vtodo.getFirstPropertyValue('summary') as string;
      const description = vtodo.getFirstPropertyValue('description') as string;
      const status = vtodo.getFirstPropertyValue('status') as string;
      const priority = vtodo.getFirstPropertyValue('priority') as number;
      
      // CATEGORIES can have multiple values - get all of them
      let categories: string | undefined;
      const categoriesProp = vtodo.getFirstProperty('categories');
      if (categoriesProp) {
        const values = categoriesProp.getValues() as string[];
        categories = values.join(',');
      }
      
      const sortOrder = vtodo.getFirstPropertyValue('x-apple-sort-order');
      const subtasksJson = vtodo.getFirstPropertyValue('x-caldav-tasks-subtasks') as string;
      const isCollapsed = vtodo.getFirstPropertyValue('x-apple-collapsed') === '1';

      // parse RELATED-TO property for parent-child relationships
      let parentUid: string | undefined;
      const relatedToProps = vtodo.getAllProperties('related-to');
      for (const prop of relatedToProps) {
        const relType = prop.getParameter('reltype');
        if (!relType || relType.toUpperCase() === 'PARENT') {
          parentUid = prop.getFirstValue() as string;
          break;
        }
      }

      // parse dates
      const created = vtodo.getFirstPropertyValue('created');
      const lastModified = vtodo.getFirstPropertyValue('last-modified');
      const dtstart = vtodo.getFirstPropertyValue('dtstart');
      const due = vtodo.getFirstPropertyValue('due');
      const completed = vtodo.getFirstPropertyValue('completed');

      // parse subtasks
      let subtasks: Subtask[] = [];
      if (subtasksJson) {
        try {
          subtasks = JSON.parse(subtasksJson);
        } catch {
          subtasks = [];
        }
      }

      // parse sort order
      const createdDate = created ? (created as ICAL.Time).toJSDate() : new Date();
      let parsedSortOrder: number;
      if (sortOrder !== null && sortOrder !== undefined) {
        parsedSortOrder = parseInt(sortOrder as string, 10);
        if (isNaN(parsedSortOrder)) {
          parsedSortOrder = toAppleEpoch(createdDate.getTime());
        }
      } else {
        parsedSortOrder = toAppleEpoch(createdDate.getTime());
      }

      tasks.push({
        id: uuidv4(),
        uid: uid || uuidv4(),
        title: summary || 'Untitled Task',
        description: description || '',
        completed: status === 'COMPLETED',
        completedAt: completed ? (completed as ICAL.Time).toJSDate() : undefined,
        priority: icalToPriority(priority || 0),
        categoryId: categories || undefined,
        startDate: dtstart ? (dtstart as ICAL.Time).toJSDate() : undefined,
        dueDate: due ? (due as ICAL.Time).toJSDate() : undefined,
        createdAt: createdDate,
        modifiedAt: lastModified ? (lastModified as ICAL.Time).toJSDate() : new Date(),
        subtasks,
        parentUid,
        isCollapsed,
        sortOrder: parsedSortOrder,
        synced: false,
      });
    }
    
    return tasks;
  } catch (error) {
    console.error('Error parsing ICS file:', error);
    return [];
  }
}

/**
 * parse a JSON file containing tasks (exported from this app)
 */
export function parseJsonTasksFile(jsonContent: string): Partial<Task>[] {
  try {
    const data = JSON.parse(jsonContent);
    
    // handle array of tasks directly
    if (Array.isArray(data)) {
      return data.map(task => ({
        ...task,
        id: uuidv4(), // Always generate new IDs
        synced: false,
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing JSON tasks file:', error);
    return [];
  }
}

/**
 * helper function to build a VTODO component
 */
function buildVtodo(task: Task): ICAL.Component {
  const vtodo = new ICAL.Component('vtodo');
  
  // required fields
  vtodo.updatePropertyWithValue('uid', task.uid);
  vtodo.updatePropertyWithValue('dtstamp', ICAL.Time.now());
  vtodo.updatePropertyWithValue('created', ICAL.Time.fromJSDate(new Date(task.createdAt)));
  vtodo.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(new Date(task.modifiedAt)));

  // title and description
  vtodo.updatePropertyWithValue('summary', task.title);
  if (task.description) {
    vtodo.updatePropertyWithValue('description', task.description);
  }

  // status
  vtodo.updatePropertyWithValue('status', task.completed ? 'COMPLETED' : 'NEEDS-ACTION');
  if (task.completed && task.completedAt) {
    vtodo.updatePropertyWithValue('completed', ICAL.Time.fromJSDate(new Date(task.completedAt)));
  }

  // priority
  vtodo.updatePropertyWithValue('priority', priorityToIcal[task.priority]);

  // dates
  if (task.startDate) {
    vtodo.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(new Date(task.startDate)));
  }
  if (task.dueDate) {
    vtodo.updatePropertyWithValue('due', ICAL.Time.fromJSDate(new Date(task.dueDate)));
  }

  // x-apple-sort-order for manual sorting
  vtodo.updatePropertyWithValue('x-apple-sort-order', task.sortOrder.toString());

  // category - properly encode multiple categories as separate values
  if (task.categoryId) {
    const categoryNames = task.categoryId.split(',').map(s => s.trim()).filter(Boolean);
    if (categoryNames.length > 0) {
      const categoriesProp = new ICAL.Property('categories', vtodo);
      categoriesProp.setValues(categoryNames);
      vtodo.addProperty(categoriesProp);
    }
  }

  // parent-child relationship
  if (task.parentUid) {
    const relatedTo = new ICAL.Property('related-to', vtodo);
    relatedTo.setValue(task.parentUid);
    relatedTo.setParameter('reltype', 'PARENT');
    vtodo.addProperty(relatedTo);
  }

  // collapsed state
  if (task.isCollapsed) {
    vtodo.updatePropertyWithValue('x-apple-collapsed', '1');
  }

  // legacy subtasks
  if (task.subtasks.length > 0) {
    const subtasksJson = JSON.stringify(task.subtasks);
    vtodo.updatePropertyWithValue('x-caldav-tasks-subtasks', subtasksJson);
  }

  return vtodo;
}
