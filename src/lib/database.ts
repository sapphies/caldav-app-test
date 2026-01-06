/**
 * SQLite database layer using Tauri SQL plugin
 * Replaces localStorage-based persistence
 */

import Database from '@tauri-apps/plugin-sql';
import type {
  Task,
  Tag,
  Account,
  Calendar,
  SortConfig,
  Priority,
} from '@/types';
import { createLogger } from './logger';

const log = createLogger('Database', '#8b5cf6');

// Database connection instance
let db: Database | null = null;

// Database name
const DB_NAME = 'sqlite:caldav-tasks.db';

// Pending deletion interface
export interface PendingDeletion {
  uid: string;
  href: string;
  accountId: string;
  calendarId: string;
}

// UI State interface
export interface UIState {
  activeAccountId: string | null;
  activeCalendarId: string | null;
  activeTagId: string | null;
  selectedTaskId: string | null;
  searchQuery: string;
  sortConfig: SortConfig;
  showCompletedTasks: boolean;
  isEditorOpen: boolean;
}

// Complete data store interface
export interface DataStore {
  tasks: Task[];
  tags: Tag[];
  accounts: Account[];
  pendingDeletions: PendingDeletion[];
  ui: UIState;
}

// Default UI state
const defaultUIState: UIState = {
  activeAccountId: null,
  activeCalendarId: null,
  activeTagId: null,
  selectedTaskId: null,
  searchQuery: '',
  sortConfig: { mode: 'manual', direction: 'asc' },
  showCompletedTasks: true,
  isEditorOpen: false,
};

// Event listeners for data changes
type DataChangeListener = () => void;
const listeners: Set<DataChangeListener> = new Set();

export function subscribeToDataChanges(listener: DataChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  listeners.forEach(listener => listener());
}

// Initialize database connection
export async function initDatabase(): Promise<Database> {
  if (db) return db;
  
  try {
    db = await Database.load(DB_NAME);
    log.info('Connected to SQLite database');
    
    return db;
  } catch (error) {
    log.error('Failed to connect:', error);
    throw error;
  }
}

// Get database instance (ensures initialization)
async function getDb(): Promise<Database> {
  if (!db) {
    await initDatabase();
  }
  return db!;
}

// Helper to convert database row to Task
function rowToTask(row: any): Task {
  return {
    id: row.id,
    uid: row.uid,
    etag: row.etag || undefined,
    href: row.href || undefined,
    title: row.title,
    description: row.description,
    completed: row.completed === 1,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    categoryId: row.category_id || undefined,
    priority: row.priority as Priority,
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    startDateAllDay: row.start_date_all_day === 1,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    dueDateAllDay: row.due_date_all_day === 1,
    createdAt: new Date(row.created_at),
    modifiedAt: new Date(row.modified_at),
    reminders: row.reminders ? JSON.parse(row.reminders).map((r: any) => ({
      ...r,
      trigger: new Date(r.trigger),
    })) : undefined,
    subtasks: row.subtasks ? JSON.parse(row.subtasks) : [],
    parentUid: row.parent_uid || undefined,
    isCollapsed: row.is_collapsed === 1,
    sortOrder: row.sort_order,
    accountId: row.account_id || '',
    calendarId: row.calendar_id || '',
    synced: row.synced === 1,
    localOnly: row.local_only === 1,
  };
}

// Helper to convert database row to Account (with calendars)
function rowToAccount(row: any, calendars: Calendar[]): Account {
  return {
    id: row.id,
    name: row.name,
    serverUrl: row.server_url,
    username: row.username,
    password: row.password,
    serverType: row.server_type || undefined,
    calendars: calendars.filter(c => c.accountId === row.id),
    lastSync: row.last_sync ? new Date(row.last_sync) : undefined,
    isActive: row.is_active === 1,
  };
}

// Helper to convert database row to Calendar
function rowToCalendar(row: any): Calendar {
  return {
    id: row.id,
    displayName: row.display_name,
    url: row.url,
    ctag: row.ctag || undefined,
    syncToken: row.sync_token || undefined,
    color: row.color || undefined,
    icon: row.icon || undefined,
    accountId: row.account_id,
    supportedComponents: row.supported_components ? JSON.parse(row.supported_components) : undefined,
  };
}

// Helper to convert database row to Tag
function rowToTag(row: any): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon || undefined,
  };
}

// task operations

export async function getAllTasks(): Promise<Task[]> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tasks');
  return rows.map(rowToTask);
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows.length > 0 ? rowToTask(rows[0]) : undefined;
}

export async function getTaskByUid(uid: string): Promise<Task | undefined> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tasks WHERE uid = $1', [uid]);
  return rows.length > 0 ? rowToTask(rows[0]) : undefined;
}

export async function getTasksByCalendar(calendarId: string): Promise<Task[]> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tasks WHERE calendar_id = $1', [calendarId]);
  return rows.map(rowToTask);
}

export async function getTasksByTag(tagId: string): Promise<Task[]> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tasks WHERE tags LIKE $1', [`%"${tagId}"%`]);
  return rows.map(rowToTask);
}

export async function getChildTasks(parentUid: string): Promise<Task[]> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tasks WHERE parent_uid = $1', [parentUid]);
  return rows.map(rowToTask);
}

export async function countChildren(parentUid: string): Promise<number> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT COUNT(*) as count FROM tasks WHERE parent_uid = $1', [parentUid]);
  return rows[0]?.count || 0;
}

export async function createTask(taskData: Partial<Task>): Promise<Task> {
  const database = await getDb();
  const { v4: uuidv4 } = await import('uuid');
  const { toAppleEpoch } = await import('@/utils/ical');
  const { useSettingsStore } = await import('@/store/settingsStore');
  
  const now = new Date();
  const { defaultCalendarId, defaultPriority, defaultTags } = useSettingsStore.getState();
  
  // Get UI state for active context
  const uiState = await getUIState();
  
  // Determine calendar and account to use
  let calendarId = taskData.calendarId || uiState.activeCalendarId;
  let accountId = taskData.accountId || uiState.activeAccountId;
  
  // Handle tags
  let tags = taskData.tags || [];
  if (uiState.activeTagId && !tags.includes(uiState.activeTagId)) {
    tags = [uiState.activeTagId, ...tags];
  }
  if (tags.length === 0 && defaultTags.length > 0) {
    tags = [...defaultTags];
  }
  
  // If no active calendar, find one
  if (!calendarId) {
    const accounts = await getAllAccounts();
    if (defaultCalendarId) {
      for (const account of accounts) {
        const calendar = account.calendars.find(c => c.id === defaultCalendarId);
        if (calendar) {
          calendarId = calendar.id;
          accountId = account.id;
          break;
        }
      }
    }
    
    if (!calendarId) {
      const firstAccount = accounts.find(a => a.calendars.length > 0);
      if (firstAccount) {
        calendarId = firstAccount.calendars[0].id;
        accountId = firstAccount.id;
      }
    }
  }
  
  // Calculate sort order
  const maxOrderRows = await database.select<any[]>('SELECT MAX(sort_order) as max_order FROM tasks');
  const maxSortOrder = maxOrderRows[0]?.max_order ?? (toAppleEpoch(now.getTime()) - 1);
  
  // Determine if this is a local-only task
  const isLocalOnly = !calendarId || !accountId;
  
  const task: Task = {
    id: uuidv4(),
    uid: uuidv4(),
    title: taskData.title || 'New Task',
    description: taskData.description || '',
    completed: false,
    priority: taskData.priority || defaultPriority,
    subtasks: taskData.subtasks || [],
    sortOrder: maxSortOrder + 1,
    accountId: accountId || '',
    calendarId: calendarId || '',
    synced: false,
    createdAt: now,
    modifiedAt: now,
    localOnly: isLocalOnly,
    ...taskData,
    tags,
  };
  
  await database.execute(
    `INSERT INTO tasks (
      id, uid, etag, href, title, description, completed, completed_at,
      tags, category_id, priority, start_date, start_date_all_day,
      due_date, due_date_all_day, created_at, modified_at, reminders,
      subtasks, parent_uid, is_collapsed, sort_order, account_id,
      calendar_id, synced, local_only
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
    [
      task.id,
      task.uid,
      task.etag || null,
      task.href || null,
      task.title,
      task.description,
      task.completed ? 1 : 0,
      task.completedAt ? task.completedAt.toISOString() : null,
      task.tags && task.tags.length > 0 ? JSON.stringify(task.tags) : null,
      task.categoryId || null,
      task.priority,
      task.startDate ? task.startDate.toISOString() : null,
      task.startDateAllDay ? 1 : 0,
      task.dueDate ? task.dueDate.toISOString() : null,
      task.dueDateAllDay ? 1 : 0,
      task.createdAt.toISOString(),
      task.modifiedAt.toISOString(),
      task.reminders && task.reminders.length > 0 ? JSON.stringify(task.reminders) : null,
      JSON.stringify(task.subtasks),
      task.parentUid || null,
      task.isCollapsed ? 1 : 0,
      task.sortOrder,
      task.accountId || null,
      task.calendarId || null,
      task.synced ? 1 : 0,
      task.localOnly ? 1 : 0,
    ]
  );
  
  notifyListeners();
  return task;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
  const database = await getDb();
  const existing = await getTaskById(id);
  if (!existing) return undefined;
  
  const updatedTask: Task = {
    ...existing,
    ...updates,
    modifiedAt: updates.modifiedAt !== undefined ? updates.modifiedAt : new Date(),
    synced: updates.synced !== undefined ? updates.synced : false,
  };
  
  await database.execute(
    `UPDATE tasks SET
      uid = $1, etag = $2, href = $3, title = $4, description = $5,
      completed = $6, completed_at = $7, tags = $8, category_id = $9,
      priority = $10, start_date = $11, start_date_all_day = $12,
      due_date = $13, due_date_all_day = $14, modified_at = $15,
      reminders = $16, subtasks = $17, parent_uid = $18, is_collapsed = $19,
      sort_order = $20, account_id = $21, calendar_id = $22, synced = $23,
      local_only = $24
     WHERE id = $25`,
    [
      updatedTask.uid,
      updatedTask.etag || null,
      updatedTask.href || null,
      updatedTask.title,
      updatedTask.description,
      updatedTask.completed ? 1 : 0,
      updatedTask.completedAt ? updatedTask.completedAt.toISOString() : null,
      updatedTask.tags && updatedTask.tags.length > 0 ? JSON.stringify(updatedTask.tags) : null,
      updatedTask.categoryId || null,
      updatedTask.priority,
      updatedTask.startDate ? updatedTask.startDate.toISOString() : null,
      updatedTask.startDateAllDay ? 1 : 0,
      updatedTask.dueDate ? updatedTask.dueDate.toISOString() : null,
      updatedTask.dueDateAllDay ? 1 : 0,
      updatedTask.modifiedAt.toISOString(),
      updatedTask.reminders && updatedTask.reminders.length > 0 ? JSON.stringify(updatedTask.reminders) : null,
      JSON.stringify(updatedTask.subtasks),
      updatedTask.parentUid || null,
      updatedTask.isCollapsed ? 1 : 0,
      updatedTask.sortOrder,
      updatedTask.accountId || null,
      updatedTask.calendarId || null,
      updatedTask.synced ? 1 : 0,
      updatedTask.localOnly ? 1 : 0,
      id,
    ]
  );
  
  notifyListeners();
  return updatedTask;
}

export async function deleteTask(id: string, deleteChildren: boolean = true): Promise<void> {
  const database = await getDb();
  const task = await getTaskById(id);
  if (!task) return;
  
  // Get all descendants recursively
  const getAllDescendantIds = async (parentUid: string): Promise<string[]> => {
    const children = await getChildTasks(parentUid);
    const childIds = children.map(c => c.id);
    const descendantIds = await Promise.all(children.map(c => getAllDescendantIds(c.uid)));
    return [...childIds, ...descendantIds.flat()];
  };
  
  const descendantIds = await getAllDescendantIds(task.uid);
  const tasksToDeleteIds = deleteChildren ? [id, ...descendantIds] : [id];
  
  // Get tasks with href for pending deletions
  const tasksToDelete = await Promise.all(tasksToDeleteIds.map(getTaskById));
  const tasksWithHref = tasksToDelete.filter((t): t is Task => !!t && !!t.href);
  
  // Add to pending deletions
  for (const t of tasksWithHref) {
    await database.execute(
      `INSERT OR REPLACE INTO pending_deletions (uid, href, account_id, calendar_id)
       VALUES ($1, $2, $3, $4)`,
      [t.uid, t.href, t.accountId, t.calendarId]
    );
  }
  
  // If not deleting children, orphan them
  if (!deleteChildren) {
    await database.execute(
      `UPDATE tasks SET parent_uid = NULL, modified_at = $1, synced = 0 WHERE parent_uid = $2`,
      [new Date().toISOString(), task.uid]
    );
  }
  
  // Delete tasks
  const placeholders = tasksToDeleteIds.map((_, i) => `$${i + 1}`).join(', ');
  await database.execute(`DELETE FROM tasks WHERE id IN (${placeholders})`, tasksToDeleteIds);
  
  // Update UI state if selected task was deleted
  const uiState = await getUIState();
  if (tasksToDeleteIds.includes(uiState.selectedTaskId || '')) {
    await setSelectedTask(null);
  }
  
  notifyListeners();
}

export async function toggleTaskComplete(id: string): Promise<void> {
  const task = await getTaskById(id);
  if (!task) return;
  
  await updateTask(id, {
    completed: !task.completed,
    completedAt: !task.completed ? new Date() : undefined,
  });
}

// tag operations

export async function getAllTags(): Promise<Tag[]> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tags');
  return rows.map(rowToTag);
}

export async function getTagById(id: string): Promise<Tag | undefined> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM tags WHERE id = $1', [id]);
  return rows.length > 0 ? rowToTag(rows[0]) : undefined;
}

export async function createTag(tagData: Partial<Tag>): Promise<Tag> {
  const database = await getDb();
  const { v4: uuidv4 } = await import('uuid');
  
  const tag: Tag = {
    id: uuidv4(),
    name: tagData.name || 'New Tag',
    color: tagData.color || '#3b82f6',
    icon: tagData.icon,
  };
  
  await database.execute(
    `INSERT INTO tags (id, name, color, icon) VALUES ($1, $2, $3, $4)`,
    [tag.id, tag.name, tag.color, tag.icon || null]
  );
  
  notifyListeners();
  return tag;
}

export async function updateTag(id: string, updates: Partial<Tag>): Promise<Tag | undefined> {
  const database = await getDb();
  const existing = await getTagById(id);
  if (!existing) return undefined;
  
  const updatedTag: Tag = { ...existing, ...updates };
  
  await database.execute(
    `UPDATE tags SET name = $1, color = $2, icon = $3 WHERE id = $4`,
    [updatedTag.name, updatedTag.color, updatedTag.icon || null, id]
  );
  
  notifyListeners();
  return updatedTag;
}

export async function deleteTag(id: string): Promise<void> {
  const database = await getDb();
  
  // Remove tag from all tasks
  const tasks = await getTasksByTag(id);
  for (const task of tasks) {
    const newTags = (task.tags || []).filter(t => t !== id);
    await updateTask(task.id, { tags: newTags });
  }
  
  await database.execute('DELETE FROM tags WHERE id = $1', [id]);
  
  // Update UI state if this was the active tag
  const uiState = await getUIState();
  if (uiState.activeTagId === id) {
    await setActiveTag(null);
  }
  
  notifyListeners();
}

// account operations

export async function getAllAccounts(): Promise<Account[]> {
  const database = await getDb();
  
  const accountRows = await database.select<any[]>('SELECT * FROM accounts');
  const calendarRows = await database.select<any[]>('SELECT * FROM calendars');
  const calendars = calendarRows.map(rowToCalendar);
  
  return accountRows.map(row => rowToAccount(row, calendars));
}

export async function getAccountById(id: string): Promise<Account | undefined> {
  const accounts = await getAllAccounts();
  return accounts.find(a => a.id === id);
}

export async function createAccount(accountData: Partial<Account>): Promise<Account> {
  const database = await getDb();
  const { v4: uuidv4 } = await import('uuid');
  
  const account: Account = {
    id: accountData.id || uuidv4(),
    name: accountData.name || 'New Account',
    serverUrl: accountData.serverUrl || '',
    username: accountData.username || '',
    password: accountData.password || '',
    serverType: accountData.serverType,
    calendars: [],
    isActive: true,
  };
  
  await database.execute(
    `INSERT INTO accounts (id, name, server_url, username, password, server_type, last_sync, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      account.id,
      account.name,
      account.serverUrl,
      account.username,
      account.password,
      account.serverType || null,
      account.lastSync ? account.lastSync.toISOString() : null,
      account.isActive ? 1 : 0,
    ]
  );
  
  // Set as active account if none set
  const uiState = await getUIState();
  if (!uiState.activeAccountId) {
    await database.execute(`UPDATE ui_state SET active_account_id = $1 WHERE id = 1`, [account.id]);
  }
  
  notifyListeners();
  return account;
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<Account | undefined> {
  const database = await getDb();
  const existing = await getAccountById(id);
  if (!existing) return undefined;
  
  const updatedAccount: Account = { ...existing, ...updates };
  
  await database.execute(
    `UPDATE accounts SET name = $1, server_url = $2, username = $3, password = $4, server_type = $5, last_sync = $6, is_active = $7
     WHERE id = $8`,
    [
      updatedAccount.name,
      updatedAccount.serverUrl,
      updatedAccount.username,
      updatedAccount.password,
      updatedAccount.serverType || null,
      updatedAccount.lastSync ? updatedAccount.lastSync.toISOString() : null,
      updatedAccount.isActive ? 1 : 0,
      id,
    ]
  );
  
  notifyListeners();
  return updatedAccount;
}

export async function deleteAccount(id: string): Promise<void> {
  const database = await getDb();
  
  // Delete cascades to calendars and tasks via foreign keys
  await database.execute('DELETE FROM accounts WHERE id = $1', [id]);
  
  // Update UI state
  const accounts = await getAllAccounts();
  const uiState = await getUIState();
  if (uiState.activeAccountId === id) {
    await database.execute(
      `UPDATE ui_state SET active_account_id = $1 WHERE id = 1`,
      [accounts[0]?.id || null]
    );
  }
  
  notifyListeners();
}

export async function addCalendar(accountId: string, calendarData: Partial<Calendar>): Promise<void> {
  const database = await getDb();
  const { v4: uuidv4 } = await import('uuid');
  
  const calendar: Calendar = {
    ...calendarData,
    id: calendarData.id || uuidv4(),
    displayName: calendarData.displayName || 'Tasks',
    url: calendarData.url || '',
    accountId,
  };
  
  log.debug(`Adding calendar: ${calendar.displayName} with ID: ${calendar.id}`);
  
  await database.execute(
    `INSERT INTO calendars (id, account_id, display_name, url, ctag, sync_token, color, icon, supported_components)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      calendar.id,
      accountId,
      calendar.displayName,
      calendar.url,
      calendar.ctag || null,
      calendar.syncToken || null,
      calendar.color || null,
      calendar.icon || null,
      calendar.supportedComponents ? JSON.stringify(calendar.supportedComponents) : null,
    ]
  );
  
  // Set as active calendar if none set
  const uiState = await getUIState();
  if (!uiState.activeCalendarId) {
    await database.execute(`UPDATE ui_state SET active_calendar_id = $1 WHERE id = 1`, [calendar.id]);
  }
  
  notifyListeners();
}

export async function deleteCalendar(_accountId: string, calendarId: string): Promise<void> {
  const database = await getDb();
  
  // Get tasks to track for server deletion
  const tasks = await getTasksByCalendar(calendarId);
  const tasksWithHref = tasks.filter(t => t.href);
  
  for (const t of tasksWithHref) {
    await database.execute(
      `INSERT OR REPLACE INTO pending_deletions (uid, href, account_id, calendar_id)
       VALUES ($1, $2, $3, $4)`,
      [t.uid, t.href, t.accountId, t.calendarId]
    );
  }
  
  // Delete calendar (tasks cascade)
  await database.execute('DELETE FROM calendars WHERE id = $1', [calendarId]);
  
  // Update UI state
  const uiState = await getUIState();
  if (uiState.activeCalendarId === calendarId) {
    const accounts = await getAllAccounts();
    const otherCalendars = accounts.flatMap(a => a.calendars).filter(c => c.id !== calendarId);
    await database.execute(
      `UPDATE ui_state SET active_calendar_id = $1 WHERE id = 1`,
      [otherCalendars[0]?.id || null]
    );
  }
  
  notifyListeners();
}

// pending deletions operations

export async function getPendingDeletions(): Promise<PendingDeletion[]> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM pending_deletions');
  return rows.map(row => ({
    uid: row.uid,
    href: row.href,
    accountId: row.account_id,
    calendarId: row.calendar_id,
  }));
}

export async function clearPendingDeletion(uid: string): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM pending_deletions WHERE uid = $1', [uid]);
  notifyListeners();
}

// ui state operations

export async function getUIState(): Promise<UIState> {
  const database = await getDb();
  const rows = await database.select<any[]>('SELECT * FROM ui_state WHERE id = 1');
  
  if (rows.length === 0) {
    return defaultUIState;
  }
  
  const row = rows[0];
  return {
    activeAccountId: row.active_account_id,
    activeCalendarId: row.active_calendar_id,
    activeTagId: row.active_tag_id,
    selectedTaskId: row.selected_task_id,
    searchQuery: row.search_query,
    sortConfig: {
      mode: row.sort_mode,
      direction: row.sort_direction,
    },
    showCompletedTasks: row.show_completed_tasks === 1,
    isEditorOpen: row.is_editor_open === 1,
  };
}

export async function setActiveAccount(id: string | null): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE ui_state SET active_account_id = $1, active_calendar_id = NULL WHERE id = 1`,
    [id]
  );
  notifyListeners();
}

export async function setActiveCalendar(id: string | null): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE ui_state SET active_calendar_id = $1, active_tag_id = NULL, selected_task_id = NULL, is_editor_open = 0 WHERE id = 1`,
    [id]
  );
  notifyListeners();
}

export async function setActiveTag(id: string | null): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE ui_state SET active_tag_id = $1, active_calendar_id = NULL, selected_task_id = NULL, is_editor_open = 0 WHERE id = 1`,
    [id]
  );
  notifyListeners();
}

export async function setAllTasksView(): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE ui_state SET active_calendar_id = NULL, active_tag_id = NULL, selected_task_id = NULL, is_editor_open = 0 WHERE id = 1`,
    []
  );
  notifyListeners();
}

export async function setSelectedTask(id: string | null): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE ui_state SET selected_task_id = $1, is_editor_open = $2 WHERE id = 1`,
    [id, id !== null ? 1 : 0]
  );
  notifyListeners();
}

export async function setEditorOpen(open: boolean): Promise<void> {
  const database = await getDb();
  const uiState = await getUIState();
  await database.execute(
    `UPDATE ui_state SET is_editor_open = $1, selected_task_id = $2 WHERE id = 1`,
    [open ? 1 : 0, open ? uiState.selectedTaskId : null]
  );
  notifyListeners();
}

export async function setSearchQuery(query: string): Promise<void> {
  const database = await getDb();
  await database.execute(`UPDATE ui_state SET search_query = $1 WHERE id = 1`, [query]);
  notifyListeners();
}

export async function setSortConfig(config: SortConfig): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE ui_state SET sort_mode = $1, sort_direction = $2 WHERE id = 1`,
    [config.mode, config.direction]
  );
  notifyListeners();
}

export async function setShowCompletedTasks(show: boolean): Promise<void> {
  const database = await getDb();
  await database.execute(`UPDATE ui_state SET show_completed_tasks = $1 WHERE id = 1`, [show ? 1 : 0]);
  notifyListeners();
}

// snapshot

export async function getDataSnapshot(): Promise<DataStore> {
  const [tasks, tags, accounts, pendingDeletions, ui] = await Promise.all([
    getAllTasks(),
    getAllTags(),
    getAllAccounts(),
    getPendingDeletions(),
    getUIState(),
  ]);
  
  return { tasks, tags, accounts, pendingDeletions, ui };
}
