/**
 * Task data persistence layer
 * This module handles the storage and retrieval of tasks, accounts, tags, and UI state
 * Uses SQLite via Tauri SQL plugin with in-memory cache for synchronous access
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  Tag,
  Account,
  Calendar,
  SortConfig,
  Priority,
  Subtask,
  Reminder,
} from '@/types';
import { toAppleEpoch } from '@/utils/ical';
import { useSettingsStore } from '@/store/settingsStore';
import * as db from './database';
import { loggers } from './logger';

const log = loggers.taskData;

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

// Default data store
const defaultDataStore: DataStore = {
  tasks: [],
  tags: [],
  accounts: [],
  pendingDeletions: [],
  ui: defaultUIState,
};

// In-memory cache of the data store
let dataStoreCache: DataStore | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Event listeners for data changes
type DataChangeListener = () => void;
const listeners: Set<DataChangeListener> = new Set();

export function subscribeToDataChanges(listener: DataChangeListener): () => void {
  listeners.add(listener);
  // Also subscribe to database changes
  db.subscribeToDataChanges(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  listeners.forEach(listener => listener());
}

// Initialize the database and load data into cache
export async function initializeDataStore(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    await db.initDatabase();
    await refreshCache();
    isInitialized = true;
    log.info('Data store initialized with SQLite');
  })();
  
  return initPromise;
}

// Refresh cache from database
async function refreshCache(): Promise<void> {
  try {
    dataStoreCache = await db.getDataSnapshot();
  } catch (error) {
    log.error('Failed to refresh cache:', error);
  }
}

// Load data from cache (must be initialized first)
function loadDataStore(): DataStore {
  if (!dataStoreCache) {
    log.warn('Data store not initialized, returning defaults');
    return { ...defaultDataStore };
  }
  return dataStoreCache;
}

// Save data to cache and notify listeners
// Note: Individual operations must call db.* functions to persist to SQLite
function saveDataStore(data: DataStore): void {
  dataStoreCache = data;
  notifyListeners();
}

// Get a snapshot of the current data
export function getDataSnapshot(): DataStore {
  return loadDataStore();
}

// Task operations
export function getAllTasks(): Task[] {
  return loadDataStore().tasks;
}

export function getTaskById(id: string): Task | undefined {
  return loadDataStore().tasks.find(t => t.id === id);
}

export function getTaskByUid(uid: string): Task | undefined {
  return loadDataStore().tasks.find(t => t.uid === uid);
}

export function getTasksByCalendar(calendarId: string): Task[] {
  return loadDataStore().tasks.filter(t => t.calendarId === calendarId);
}

// Alias for getTasksByCalendar (for compatibility)
export function getCalendarTasks(calendarId: string): Task[] {
  return getTasksByCalendar(calendarId);
}

export function getTasksByTag(tagId: string): Task[] {
  return loadDataStore().tasks.filter(t => (t.tags || []).includes(tagId));
}

export function getChildTasks(parentUid: string): Task[] {
  return loadDataStore().tasks.filter(t => t.parentUid === parentUid);
}

export function countChildren(parentUid: string): number {
  return loadDataStore().tasks.filter(t => t.parentUid === parentUid).length;
}

export function getAllDescendants(parentUid: string): Task[] {
  const tasks = loadDataStore().tasks;
  const getDescendants = (uid: string): Task[] => {
    const children = tasks.filter(t => t.parentUid === uid);
    return [
      ...children,
      ...children.flatMap(child => getDescendants(child.uid)),
    ];
  };
  return getDescendants(parentUid);
}

export function createTask(taskData: Partial<Task>): Task {
  const data = loadDataStore();
  const now = new Date();
  
  // Get default calendar and task defaults from settings
  const { defaultCalendarId, defaultPriority, defaultTags } = useSettingsStore.getState();
  
  // Determine calendar and account to use
  let calendarId = taskData.calendarId || data.ui.activeCalendarId;
  let accountId = taskData.accountId || data.ui.activeAccountId;
  
  // If viewing a tag, include that tag in the new task
  let tags = taskData.tags || [];
  if (data.ui.activeTagId && !tags.includes(data.ui.activeTagId)) {
    tags = [data.ui.activeTagId, ...tags];
  }
  // Add default tags if no tags provided
  if (tags.length === 0 && defaultTags.length > 0) {
    tags = [...defaultTags];
  }
  
  // If no active calendar (All Tasks view), use default or first available
  if (!calendarId && data.accounts.length > 0) {
    if (defaultCalendarId) {
      // Find the calendar and its account
      for (const account of data.accounts) {
        const calendar = account.calendars.find(c => c.id === defaultCalendarId);
        if (calendar) {
          calendarId = calendar.id;
          accountId = account.id;
          break;
        }
      }
    }
    
    // Fallback to first available calendar if default not found
    if (!calendarId) {
      const firstAccount = data.accounts.find(a => a.calendars.length > 0);
      if (firstAccount) {
        calendarId = firstAccount.calendars[0].id;
        accountId = firstAccount.id;
      }
    }
  }
  
  // Determine if this is a local-only task (no calendar/account assigned)
  const isLocalOnly = !calendarId || !accountId;
  
  // Calculate sort order using Apple epoch format
  const maxSortOrder = data.tasks.length > 0 
    ? Math.max(...data.tasks.map(t => t.sortOrder)) 
    : toAppleEpoch(now.getTime()) - 1;

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
    calendarId: calendarId || taskData.calendarId || data.ui.activeCalendarId || '',
    synced: false,
    createdAt: now,
    modifiedAt: now,
    localOnly: isLocalOnly,
    ...taskData,
    // Apply tags after spread to ensure activeTagId is included
    tags,
  };

  saveDataStore({
    ...data,
    tasks: [...data.tasks, task],
  });
  
  // Persist to SQLite (including local-only tasks)
  if (isInitialized) {
    db.createTask(task).catch(e => log.error('Failed to sync task to database:', e));
  }
  
  return task;
}

export function updateTask(id: string, updates: Partial<Task>): Task | undefined {
  const data = loadDataStore();
  let updatedTask: Task | undefined;
  
  const tasks = data.tasks.map(task => {
    if (task.id === id) {
      updatedTask = {
        ...task,
        ...updates,
        // Only update modifiedAt if not provided in updates (local changes)
        modifiedAt: updates.modifiedAt !== undefined ? updates.modifiedAt : new Date(),
        // Only mark as unsynced if synced is not explicitly set in updates
        synced: updates.synced !== undefined ? updates.synced : false,
      };
      return updatedTask;
    }
    return task;
  });
  
  // Persist to SQLite
  if (updatedTask) {
    db.updateTask(id, updatedTask).catch(e => log.error('Failed to persist task update:', e));
  }
  
  saveDataStore({ ...data, tasks });
  return updatedTask;
}

export function deleteTask(id: string, deleteChildren: boolean = true): void {
  const data = loadDataStore();
  const task = data.tasks.find(t => t.id === id);
  if (!task) return;
  
  // Persist to SQLite
  db.deleteTask(id, deleteChildren).catch(e => log.error('Failed to persist task deletion:', e));
  
  // Get all descendants recursively
  const getAllDescendantIds = (parentUid: string): string[] => {
    const children = data.tasks.filter(t => t.parentUid === parentUid);
    const childIds = children.map(c => c.id);
    const descendantIds = children.flatMap(c => getAllDescendantIds(c.uid));
    return [...childIds, ...descendantIds];
  };
  
  const descendantIds = getAllDescendantIds(task.uid);
  const tasksToDelete = deleteChildren ? [id, ...descendantIds] : [id];
  
  // Collect all tasks that need to be tracked for server deletion
  const tasksWithHref = data.tasks.filter(t => 
    tasksToDelete.includes(t.id) && t.href
  );
  
  const newPendingDeletions = [
    ...data.pendingDeletions,
    ...tasksWithHref.map(t => ({
      uid: t.uid,
      href: t.href!,
      accountId: t.accountId,
      calendarId: t.calendarId,
    })),
  ];
  
  // If not deleting children, orphan them (move to root level)
  let updatedTasks = data.tasks;
  if (!deleteChildren) {
    updatedTasks = updatedTasks.map(t => 
      t.parentUid === task.uid 
        ? { ...t, parentUid: undefined, modifiedAt: new Date(), synced: false }
        : t
    );
  }
  
  saveDataStore({
    ...data,
    tasks: updatedTasks.filter(t => !tasksToDelete.includes(t.id)),
    pendingDeletions: newPendingDeletions,
    ui: {
      ...data.ui,
      selectedTaskId: tasksToDelete.includes(data.ui.selectedTaskId || '') ? null : data.ui.selectedTaskId,
    },
  });
}

export function toggleTaskComplete(id: string): void {
  const data = loadDataStore();
  const task = data.tasks.find(t => t.id === id);
  if (!task) return;
  
  const updates = {
    completed: !task.completed,
    completedAt: !task.completed ? new Date() : undefined,
    modifiedAt: new Date(),
    synced: false,
  };
  
  // Persist to SQLite
  db.updateTask(id, updates).catch(e => log.error('Failed to persist task toggle:', e));
  
  const tasks = data.tasks.map(t =>
    t.id === id ? { ...t, ...updates } : t
  );
  saveDataStore({ ...data, tasks });
}

export function toggleTaskCollapsed(id: string): void {
  const data = loadDataStore();
  const task = data.tasks.find(t => t.id === id);
  if (!task) return;
  
  const updates = {
    isCollapsed: !task.isCollapsed,
    modifiedAt: new Date(),
    synced: false,
  };
  
  // Persist to SQLite
  db.updateTask(id, updates).catch(e => log.error('Failed to persist task collapse:', e));
  
  const tasks = data.tasks.map(t =>
    t.id === id ? { ...t, ...updates } : t
  );
  saveDataStore({ ...data, tasks });
}

export function setTaskParent(taskId: string, parentUid: string | undefined): void {
  const data = loadDataStore();
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  // Prevent circular references
  if (parentUid) {
    const isDescendant = (checkUid: string): boolean => {
      const parent = data.tasks.find(t => t.uid === checkUid);
      if (!parent) return false;
      if (parent.id === taskId) return true;
      return parent.parentUid ? isDescendant(parent.parentUid) : false;
    };
    if (isDescendant(parentUid)) return;
  }
  
  // Calculate new sort order based on siblings
  let newSortOrder = task.sortOrder;
  if (parentUid) {
    const siblings = data.tasks.filter(t => t.parentUid === parentUid);
    if (siblings.length > 0) {
      newSortOrder = Math.max(...siblings.map(t => t.sortOrder)) + 1;
    }
  }
  
  // If setting a parent, inherit the parent's calendar if different
  let inheritedCalendarId: string | undefined;
  let inheritedAccountId: string | undefined;
  
  if (parentUid) {
    const parentTask = data.tasks.find(t => t.uid === parentUid);
    if (parentTask && parentTask.calendarId !== task.calendarId) {
      inheritedCalendarId = parentTask.calendarId;
      inheritedAccountId = parentTask.accountId;
    }
  }
  
  // Get all descendants to also update their calendar
  const descendantIds = inheritedCalendarId ? getAllDescendants(task.uid).map(t => t.id) : [];
  
  const tasks = data.tasks.map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        parentUid,
        sortOrder: newSortOrder,
        ...(inheritedCalendarId && { calendarId: inheritedCalendarId }),
        ...(inheritedAccountId && { accountId: inheritedAccountId }),
        modifiedAt: new Date(),
        synced: false,
      };
    }
    // Also update descendants' calendar
    if (inheritedCalendarId && inheritedAccountId && descendantIds.includes(t.id)) {
      return {
        ...t,
        calendarId: inheritedCalendarId,
        accountId: inheritedAccountId,
        modifiedAt: new Date(),
        synced: false,
      };
    }
    return t;
  });
  
  saveDataStore({ ...data, tasks });
}

// Subtask operations
export function addSubtask(taskId: string, title: string): void {
  const data = loadDataStore();
  const subtask: Subtask = {
    id: uuidv4(),
    title,
    completed: false,
  };
  
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          subtasks: [...task.subtasks, subtask],
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

export function updateSubtask(taskId: string, subtaskId: string, updates: Partial<Subtask>): void {
  const data = loadDataStore();
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          subtasks: task.subtasks.map(st =>
            st.id === subtaskId ? { ...st, ...updates } : st
          ),
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

export function deleteSubtask(taskId: string, subtaskId: string): void {
  const data = loadDataStore();
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          subtasks: task.subtasks.filter(st => st.id !== subtaskId),
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

export function toggleSubtaskComplete(taskId: string, subtaskId: string): void {
  const data = loadDataStore();
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          subtasks: task.subtasks.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          ),
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

// Tag operations on tasks
export function addTagToTask(taskId: string, tagId: string): void {
  const data = loadDataStore();
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          tags: [...(task.tags || []).filter(t => t !== tagId), tagId],
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

export function removeTagFromTask(taskId: string, tagId: string): void {
  const data = loadDataStore();
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          tags: (task.tags || []).filter(t => t !== tagId),
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

// Reminder operations
export function addReminder(taskId: string, trigger: Date): void {
  const data = loadDataStore();
  const reminder: Reminder = {
    id: uuidv4(),
    trigger,
  };
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          reminders: [...(task.reminders || []), reminder],
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

export function removeReminder(taskId: string, reminderId: string): void {
  const data = loadDataStore();
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          reminders: (task.reminders || []).filter(r => r.id !== reminderId),
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

export function updateReminder(taskId: string, reminderId: string, trigger: Date): void {
  const data = loadDataStore();
  const tasks = data.tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          reminders: (task.reminders || []).map(r =>
            r.id === reminderId ? { ...r, trigger } : r
          ),
          modifiedAt: new Date(),
          synced: false,
        }
      : task
  );
  saveDataStore({ ...data, tasks });
}

// Task reordering
interface FlattenedTask {
  id: string;
  uid: string;
  title: string;
  depth: number;
  parentUid?: string;
  ancestorIds: string[];
  sortOrder: number;
}

export function reorderTasks(
  activeId: string,
  overId: string,
  flattenedItems: FlattenedTask[],
  targetIndent?: number
): void {
  const data = loadDataStore();
  const tasks = data.tasks;
  const activeTask = tasks.find(t => t.id === activeId);
  const overTask = tasks.find(t => t.id === overId);

  if (!activeTask || !overTask) return;

  const activeIndex = flattenedItems.findIndex(t => t.id === activeId);
  const overIndex = flattenedItems.findIndex(t => t.id === overId);

  if (activeIndex === -1 || overIndex === -1) return;

  const overItem = flattenedItems[overIndex];
  const activeItem = flattenedItems[activeIndex];
  
  // Prevent dropping into own descendants
  if (overItem.ancestorIds.includes(activeId)) {
    return;
  }

  // Determine the effective indent level
  const effectiveIndent = targetIndent ?? overItem.depth;
  
  // Find the new parent based on the target indent
  let newParentUid: string | undefined = undefined;
  
  if (effectiveIndent > 0) {
    let searchStart = activeIndex === overIndex 
      ? activeIndex - 1 
      : (activeIndex < overIndex ? overIndex : overIndex - 1);
    
    for (let i = searchStart; i >= 0; i--) {
      const candidate = flattenedItems[i];
      if (candidate.id === activeId) continue;
      
      if (candidate.depth === effectiveIndent - 1) {
        newParentUid = candidate.uid;
        break;
      }
      
      if (candidate.depth < effectiveIndent - 1) {
        break;
      }
    }
    
    if (!newParentUid && effectiveIndent > 0) {
      for (let i = (activeIndex === overIndex ? activeIndex : overIndex) - 1; i >= 0; i--) {
        const candidate = flattenedItems[i];
        if (candidate.id === activeId) continue;
        
        if (candidate.depth < effectiveIndent) {
          newParentUid = candidate.uid;
          break;
        }
      }
    }
  }

  // Get all items at the target parent level (excluding the task being moved and its descendants)
  const activeDescendantIds = new Set<string>();
  const collectDescendants = (taskId: string) => {
    for (const item of flattenedItems) {
      if (item.ancestorIds.includes(taskId)) {
        activeDescendantIds.add(item.id);
      }
    }
  };
  collectDescendants(activeId);
  
  // Get siblings at the target parent level, excluding active and its descendants
  const siblings = tasks.filter(t => 
    t.parentUid === newParentUid && 
    t.id !== activeId && 
    !activeDescendantIds.has(t.id)
  );
  const sortedSiblings = getSortedTasks(siblings, data.ui.sortConfig);
  
  // Determine where to insert among siblings based on visual position
  let insertIndex = 0;
  
  // Find the last sibling that appears before the over position in the flattened list
  for (let i = overIndex; i >= 0; i--) {
    const item = flattenedItems[i];
    if (item.id === activeId || activeDescendantIds.has(item.id)) continue;
    
    if (item.parentUid === newParentUid) {
      // Found a sibling at the target level
      const siblingIndex = sortedSiblings.findIndex(s => s.id === item.id);
      if (siblingIndex !== -1) {
        // If moving down, insert after this sibling; if moving up or same position, insert at this position
        if (activeIndex < overIndex) {
          insertIndex = siblingIndex + 1;
        } else {
          insertIndex = siblingIndex;
        }
        break;
      }
    } else if (item.uid === newParentUid) {
      // We've reached the parent itself, insert at the beginning
      insertIndex = 0;
      break;
    }
  }

  // If activeId === overId but indent changed, need to recalculate position
  if (activeId === overId && activeItem.parentUid !== newParentUid) {
    // Moving to a new parent at the same visual position
    // Find where in the new parent's children we should insert
    insertIndex = 0;
    for (let i = overIndex - 1; i >= 0; i--) {
      const item = flattenedItems[i];
      if (item.id === activeId || activeDescendantIds.has(item.id)) continue;
      
      if (item.parentUid === newParentUid) {
        const siblingIndex = sortedSiblings.findIndex(s => s.id === item.id);
        if (siblingIndex !== -1) {
          insertIndex = siblingIndex + 1;
          break;
        }
      } else if (item.uid === newParentUid) {
        insertIndex = 0;
        break;
      }
    }
  }

  // Build new order with active task inserted at the right position
  const newOrder = [...sortedSiblings];
  newOrder.splice(Math.min(insertIndex, newOrder.length), 0, activeTask);
  
  // If the task is becoming a child of another task, inherit the parent's calendar
  let inheritedCalendarId: string | undefined;
  let inheritedAccountId: string | undefined;
  
  if (newParentUid && newParentUid !== activeTask.parentUid) {
    const parentTask = tasks.find(t => t.uid === newParentUid);
    if (parentTask && parentTask.calendarId !== activeTask.calendarId) {
      inheritedCalendarId = parentTask.calendarId;
      inheritedAccountId = parentTask.accountId;
    }
  }
  
  // Assign sort orders with consistent gaps
  const updates: Map<string, { sortOrder: number; parentUid: string | undefined; calendarId?: string; accountId?: string }> = new Map();
  
  newOrder.forEach((task, index) => {
    const newSortOrder = (index + 1) * 100;
    const updateData: { sortOrder: number; parentUid: string | undefined; calendarId?: string; accountId?: string } = {
      sortOrder: newSortOrder,
      parentUid: task.id === activeId ? newParentUid : task.parentUid,
    };
    
    if (task.id === activeId && inheritedCalendarId) {
      updateData.calendarId = inheritedCalendarId;
      updateData.accountId = inheritedAccountId;
    }
    
    updates.set(task.id, updateData);
  });

  // Also update all descendants of the moved task to inherit the new calendar
  const getAllDescendantIds = (parentUid: string): string[] => {
    const children = tasks.filter(t => t.parentUid === parentUid);
    return children.flatMap(c => [c.id, ...getAllDescendantIds(c.uid)]);
  };
  
  if (inheritedCalendarId) {
    const descendantIds = getAllDescendantIds(activeTask.uid);
    descendantIds.forEach(id => {
      const existing = updates.get(id);
      if (existing) {
        existing.calendarId = inheritedCalendarId;
        existing.accountId = inheritedAccountId;
      } else {
        const task = tasks.find(t => t.id === id);
        if (task) {
          updates.set(id, {
            sortOrder: task.sortOrder,
            parentUid: task.parentUid,
            calendarId: inheritedCalendarId,
            accountId: inheritedAccountId,
          });
        }
      }
    });
  }

  // Apply all updates
  const updatedTasks = tasks.map(task => {
    const update = updates.get(task.id);
    if (update) {
      return {
        ...task,
        sortOrder: update.sortOrder,
        parentUid: update.parentUid,
        ...(update.calendarId && { calendarId: update.calendarId }),
        ...(update.accountId && { accountId: update.accountId }),
        synced: false,
        modifiedAt: new Date(),
      };
    }
    return task;
  });

  saveDataStore({ ...data, tasks: updatedTasks });
}

// Tag operations
export function getAllTags(): Tag[] {
  return loadDataStore().tags;
}

// Alias for getAllTags (for compatibility)
export function getTags(): Tag[] {
  return getAllTags();
}

export function getTagById(id: string): Tag | undefined {
  return loadDataStore().tags.find(t => t.id === id);
}

export function createTag(tagData: Partial<Tag>): Tag {
  const data = loadDataStore();
  const tag: Tag = {
    id: uuidv4(),
    name: tagData.name ?? 'New Tag',
    color: tagData.color ?? '#3b82f6',
    icon: tagData.icon,
  };
  
  // Persist to SQLite
  db.createTag(tag).catch(e => log.error('Failed to persist tag:', e));
  
  saveDataStore({ ...data, tags: [...data.tags, tag] });
  return tag;
}

export function updateTag(id: string, updates: Partial<Tag>): Tag | undefined {
  const data = loadDataStore();
  let updatedTag: Tag | undefined;
  
  const tags = data.tags.map(tag => {
    if (tag.id === id) {
      updatedTag = { ...tag, ...updates };
      return updatedTag;
    }
    return tag;
  });
  
  // Persist to SQLite
  if (updatedTag) {
    db.updateTag(id, updates).catch(e => log.error('Failed to persist tag update:', e));
  }
  
  saveDataStore({ ...data, tags });
  return updatedTag;
}

export function deleteTag(id: string): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.deleteTag(id).catch(e => log.error('Failed to persist tag deletion:', e));
  
  saveDataStore({
    ...data,
    tags: data.tags.filter(tag => tag.id !== id),
    tasks: data.tasks.map(task => ({
      ...task,
      tags: (task.tags || []).filter(t => t !== id),
    })),
    ui: {
      ...data.ui,
      activeTagId: data.ui.activeTagId === id ? null : data.ui.activeTagId,
    },
  });
}

// Account operations
export function getAllAccounts(): Account[] {
  return loadDataStore().accounts;
}

export function getAccountById(id: string): Account | undefined {
  return loadDataStore().accounts.find(a => a.id === id);
}

export function createAccount(accountData: Partial<Account>): Account {
  const data = loadDataStore();
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
  
  // Persist to SQLite
  db.createAccount(account).catch(e => log.error('Failed to persist account:', e));
  
  saveDataStore({
    ...data,
    accounts: [...data.accounts, account],
    ui: data.ui,
  });
  return account;
}

export function updateAccount(id: string, updates: Partial<Account>): Account | undefined {
  const data = loadDataStore();
  let updatedAccount: Account | undefined;
  
  const accounts = data.accounts.map(acc => {
    if (acc.id === id) {
      updatedAccount = { ...acc, ...updates };
      return updatedAccount;
    }
    return acc;
  });
  
  // Persist to SQLite
  if (updatedAccount) {
    db.updateAccount(id, updates).catch(e => log.error('Failed to persist account update:', e));
  }
  
  saveDataStore({ ...data, accounts });
  return updatedAccount;
}

export function deleteAccount(id: string): void {
  const data = loadDataStore();
  const newAccounts = data.accounts.filter(acc => acc.id !== id);
  
  // Persist to SQLite
  db.deleteAccount(id).catch(e => log.error('Failed to persist account deletion:', e));
  
  saveDataStore({
    ...data,
    accounts: newAccounts,
    ui: {
      ...data.ui,
      activeAccountId: data.ui.activeAccountId === id
        ? newAccounts[0]?.id || null
        : data.ui.activeAccountId,
    },
    tasks: data.tasks.filter(task => task.accountId !== id),
  });
}

export function addCalendar(accountId: string, calendarData: Partial<Calendar>): void {
  const data = loadDataStore();
  const calendar: Calendar = {
    ...calendarData,
    id: calendarData.id || uuidv4(),
    displayName: calendarData.displayName || 'Tasks',
    url: calendarData.url || '',
    accountId,
  };

  log.info(`Adding calendar: ${calendar.displayName} with ID: ${calendar.id}`);

  // Persist to SQLite
  db.addCalendar(accountId, calendar).catch(e => log.error('Failed to persist calendar:', e));

  // Check if this is the first calendar being added
  const allCalendars = data.accounts.flatMap(acc => acc.calendars);
  const isFirstCalendar = allCalendars.length === 0;

  // Assign local-only tasks to this calendar if it's the first one
  let updatedTasks = data.tasks;
  if (isFirstCalendar) {
    updatedTasks = data.tasks.map(task => {
      if (task.localOnly || !task.calendarId || !task.accountId) {
        log.info(`Assigning local-only task "${task.title}" to calendar: ${calendar.displayName}`);
        
        const updatedTask = {
          ...task,
          calendarId: calendar.id,
          accountId: accountId,
          localOnly: false,
          synced: false,
          modifiedAt: new Date(),
        };
        
        // Create the task in the database now that it has a valid calendar
        db.createTask(updatedTask).catch(e => log.error('Failed to persist task:', e));
        
        return updatedTask;
      }
      return task;
    });
  }

  saveDataStore({
    ...data,
    accounts: data.accounts.map(acc =>
      acc.id === accountId
        ? { ...acc, calendars: [...acc.calendars, calendar] }
        : acc
    ),
    tasks: updatedTasks,
    ui: {
      ...data.ui,
      activeCalendarId: data.ui.activeCalendarId || calendar.id,
    },
  });
}

export function deleteCalendar(accountId: string, calendarId: string): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.deleteCalendar(accountId, calendarId).catch(e => log.error('Failed to persist calendar deletion:', e));
  
  // Get all tasks to delete and track for server deletion
  const tasksToDelete = data.tasks.filter(t => t.calendarId === calendarId);
  const newPendingDeletions = [
    ...data.pendingDeletions,
    ...tasksToDelete.filter(t => t.href).map(t => ({
      uid: t.uid,
      href: t.href!,
      accountId: t.accountId,
      calendarId: t.calendarId,
    })),
  ];
  
  // Get first available calendar from other accounts/calendars for active calendar fallback
  let newActiveCalendarId = data.ui.activeCalendarId;
  if (data.ui.activeCalendarId === calendarId) {
    const otherCalendars = data.accounts
      .flatMap(acc => acc.calendars)
      .filter(cal => cal.id !== calendarId);
    newActiveCalendarId = otherCalendars[0]?.id ?? null;
  }
  
  saveDataStore({
    ...data,
    accounts: data.accounts.map(acc =>
      acc.id === accountId
        ? { ...acc, calendars: acc.calendars.filter(c => c.id !== calendarId) }
        : acc
    ),
    tasks: data.tasks.filter(t => t.calendarId !== calendarId),
    pendingDeletions: newPendingDeletions,
    ui: {
      ...data.ui,
      activeCalendarId: newActiveCalendarId,
      selectedTaskId: tasksToDelete.some(t => t.id === data.ui.selectedTaskId) ? null : data.ui.selectedTaskId,
      isEditorOpen: tasksToDelete.some(t => t.id === data.ui.selectedTaskId) ? false : data.ui.isEditorOpen,
    },
  });
}

// Pending deletion
export function getPendingDeletions(): PendingDeletion[] {
  return loadDataStore().pendingDeletions;
}

export function clearPendingDeletion(uid: string): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.clearPendingDeletion(uid).catch(e => log.error('Failed to persist pending deletion clear:', e));
  
  saveDataStore({
    ...data,
    pendingDeletions: data.pendingDeletions.filter(d => d.uid !== uid),
  });
}

// UI state operations
export function getUIState(): UIState {
  return loadDataStore().ui;
}

export function setActiveAccount(id: string | null): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setActiveAccount(id).catch(e => log.error('Failed to persist active account:', e));
  
  saveDataStore({
    ...data,
    ui: { ...data.ui, activeAccountId: id, activeCalendarId: null },
  });
}

export function setActiveCalendar(id: string | null): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setActiveCalendar(id).catch(e => log.error('Failed to persist active calendar:', e));
  
  saveDataStore({
    ...data,
    ui: {
      ...data.ui,
      activeCalendarId: id,
      activeTagId: null,
      selectedTaskId: null,
      isEditorOpen: false,
    },
  });
}

export function setActiveTag(id: string | null): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setActiveTag(id).catch(e => log.error('Failed to persist active tag:', e));
  
  saveDataStore({
    ...data,
    ui: {
      ...data.ui,
      activeTagId: id,
      activeCalendarId: null,
      selectedTaskId: null,
      isEditorOpen: false,
    },
  });
}

export function setAllTasksView(): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setAllTasksView().catch(e => log.error('Failed to persist all tasks view:', e));
  
  saveDataStore({
    ...data,
    ui: {
      ...data.ui,
      activeCalendarId: null,
      activeTagId: null,
      selectedTaskId: null,
      isEditorOpen: false,
    },
  });
}

export function setSelectedTask(id: string | null): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setSelectedTask(id).catch(e => log.error('Failed to persist selected task:', e));
  
  saveDataStore({
    ...data,
    ui: {
      ...data.ui,
      selectedTaskId: id,
      isEditorOpen: id !== null,
    },
  });
}

export function setEditorOpen(open: boolean): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setEditorOpen(open).catch(e => log.error('Failed to persist editor open:', e));
  
  saveDataStore({
    ...data,
    ui: {
      ...data.ui,
      isEditorOpen: open,
      selectedTaskId: open ? data.ui.selectedTaskId : null,
    },
  });
}

export function setSearchQuery(query: string): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setSearchQuery(query).catch(e => log.error('Failed to persist search query:', e));
  
  saveDataStore({
    ...data,
    ui: { ...data.ui, searchQuery: query },
  });
}

export function setSortConfig(config: SortConfig): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setSortConfig(config).catch(e => log.error('Failed to persist sort config:', e));
  
  saveDataStore({
    ...data,
    ui: { ...data.ui, sortConfig: config },
  });
}

export function setShowCompletedTasks(show: boolean): void {
  const data = loadDataStore();
  
  // Persist to SQLite
  db.setShowCompletedTasks(show).catch(e => log.error('Failed to persist show completed:', e));
  
  saveDataStore({
    ...data,
    ui: { ...data.ui, showCompletedTasks: show },
  });
}

// Filtering and sorting helpers

const priorityOrder: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function getFilteredTasks(): Task[] {
  const data = loadDataStore();
  const { searchQuery, showCompletedTasks, activeCalendarId, activeTagId } = data.ui;

  return data.tasks.filter(task => {
    // Filter by tag
    if (activeTagId !== null) {
      if (!(task.tags || []).includes(activeTagId)) {
        return false;
      }
    } else {
      // Filter by calendar (null means "All Tasks" view - show all)
      if (activeCalendarId !== null && task.calendarId !== activeCalendarId) {
        return false;
      }
    }

    // Filter by completion status
    if (!showCompletedTasks && task.completed) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.subtasks.some(st => st.title.toLowerCase().includes(query))
      );
    }

    return true;
  });
}

export function getSortedTasks(tasks: Task[], sortConfig?: SortConfig): Task[] {
  const config = sortConfig || loadDataStore().ui.sortConfig;
  const { mode, direction } = config;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...tasks].sort((a, b) => {
    switch (mode) {
      case 'manual':
      case 'smart':
        return (a.sortOrder - b.sortOrder) * multiplier;

      case 'due-date':
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return (
          (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) *
          multiplier
        );

      case 'start-date':
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          (new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) *
          multiplier
        );

      case 'priority':
        return (
          (priorityOrder[a.priority] - priorityOrder[b.priority]) *
          multiplier
        );

      case 'title':
        return a.title.localeCompare(b.title) * multiplier;

      case 'modified':
        return (
          (new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()) *
          multiplier
        );

      case 'created':
        return (
          (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) *
          multiplier
        );

      default:
        return 0;
    }
  });
}

// Export helpers
export function exportTaskAndChildren(taskId: string): { task: Task; descendants: Task[] } | null {
  const data = loadDataStore();
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return null;
  
  return { task, descendants: getAllDescendants(task.uid) };
}
