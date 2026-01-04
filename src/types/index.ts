export type Priority = 'high' | 'medium' | 'low' | 'none';

export type SortMode =
  | 'manual' // uses x-apple-sort-order
  | 'due-date'
  | 'start-date'
  | 'priority'
  | 'title'
  | 'modified'
  | 'created'
  | 'smart'; // smart sort using x-apple-sort-order

export type SortDirection = 'asc' | 'desc';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Reminder {
  id: string;
  trigger: Date; // absolute date/time when the reminder should fire
}

export interface Task {
  id: string;
  uid: string; // CalDAV UID
  etag?: string; // CalDAV ETag for sync
  href?: string; // CalDAV href
  
  // core fields
  title: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  
  // categorization
  tags?: string[]; // Array of tag IDs (maps to iCal CATEGORIES)
  categoryId?: string; // Raw CATEGORIES string from CalDAV (used during sync, mapped to tags)
  priority: Priority;
  
  // dates
  startDate?: Date;
  startDateAllDay?: boolean; // if true, startDate is all-day (no time component)
  dueDate?: Date;
  dueDateAllDay?: boolean; // if true, dueDate is all-day (no time component)
  createdAt: Date;
  modifiedAt: Date;
  
  // reminders
  reminders?: Reminder[];
  
  // subtasks / checklist (deprecated - use parentUid instead)
  subtasks: Subtask[];
  
  // parent-child relationship (RELATED-TO in CalDAV)
  parentUid?: string; // UID of parent task
  isCollapsed?: boolean; // Whether subtasks are collapsed in UI
  
  // sorting
  sortOrder: number; // x-apple-sort-order
  
  // sync
  accountId: string;
  calendarId: string;
  synced: boolean;
  localOnly?: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  icon?: string; // Icon name from lucide-react
}

export interface Calendar {
  id: string;
  displayName: string;
  url: string;
  ctag?: string;
  syncToken?: string;
  color?: string;
  icon?: string; // Icon name from lucide-react
  accountId: string;
  supportedComponents?: string[]; // e.g., ['VTODO', 'VEVENT']
}

export type ServerType = 'rustical' | 'radicale' | 'baikal' | 'generic';

export interface Account {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string; // stored locally, for now
  serverType?: ServerType; // defaults to 'rustical' for backward compatibility
  calendars: Calendar[];
  lastSync?: Date;
  isActive: boolean;
}

export interface SortConfig {
  mode: SortMode;
  direction: SortDirection;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultSortMode: SortMode;
  defaultSortDirection: SortDirection;
  showCompletedTasks: boolean;
  confirmBeforeDelete: boolean;
}
