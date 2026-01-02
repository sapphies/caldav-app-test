/**
 * hook for syncing CalDAV data
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { caldavService } from '@/lib/caldav';
import { Task, Calendar } from '@/types';
import { useOffline } from './useOffline';
import { generateTagColor } from '../utils/color';

export function useSync() {
  const {
    accounts,
    activeCalendarId,
    addTask,
    updateTask,
    deleteTask,
    addTag,
    updateAccount,
    clearPendingDeletion,
  } = useTaskStore();

  const { autoSync, syncInterval } = useSettingsStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const pendingSyncRef = useRef(false);
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // handle online/offline status
  const { isOffline } = useOffline({
    onOnline: () => {
      console.log('[Sync] Back online, triggering sync...');
      pendingSyncRef.current = true;
      syncAll();
    },
    onOffline: () => {
      console.log('[Sync] Going offline, changes will be synced when back online');
    },
  });

  /**
   * reconnect all accounts on app startup
   */
  const reconnectAccounts = useCallback(async () => {
    for (const account of accounts) {
      if (!caldavService.isConnected(account.id)) {
        try {
          await caldavService.reconnect(account);
          console.log(`Reconnected to account: ${account.name}`);
        } catch (error) {
          console.error(`Failed to reconnect account ${account.name}:`, error);
        }
      }
    }
  }, [accounts]);

  /**
   * sync calendars for an account - add new, remove deleted, update properties
   */
  const syncCalendarsForAccount = useCallback(async (accountId: string) => {
    const currentAccounts = useTaskStore.getState().accounts;
    const account = currentAccounts.find(a => a.id === accountId);
    if (!account) return;

    // ensure we're connected
    if (!caldavService.isConnected(accountId)) {
      await caldavService.reconnect(account);
    }

    console.log(`[Sync] Fetching calendars for account: ${account.name}`);
    const remoteCalendars = await caldavService.fetchCalendars(accountId);
    console.log(`[Sync] Found ${remoteCalendars.length} calendars on server:`, remoteCalendars.map(c => c.displayName));

    const localCalendars = account.calendars;
    const remoteCalendarIds = new Set(remoteCalendars.map(c => c.id));

    // build updated calendar list
    const updatedCalendars: Calendar[] = [];

    // add/update calendars from server
    for (const remoteCalendar of remoteCalendars) {
      const localCalendar = localCalendars.find(c => c.id === remoteCalendar.id);
      
      if (localCalendar) {
        // calendar exists - check if properties changed
        if (localCalendar.displayName !== remoteCalendar.displayName ||
            localCalendar.color !== remoteCalendar.color ||
            localCalendar.ctag !== remoteCalendar.ctag ||
            localCalendar.syncToken !== remoteCalendar.syncToken) {
          console.log(`[Sync] Updating calendar properties: ${remoteCalendar.displayName}`);
          updatedCalendars.push({
            ...localCalendar,
            displayName: remoteCalendar.displayName,
            color: remoteCalendar.color,
            ctag: remoteCalendar.ctag,
            syncToken: remoteCalendar.syncToken,
          });
        } else {
          updatedCalendars.push(localCalendar);
        }
      } else {
        // new calendar from server
        console.log(`[Sync] New calendar from server: ${remoteCalendar.displayName}`);
        updatedCalendars.push(remoteCalendar);
      }
    }

    // log calendars that were deleted on server
    for (const localCalendar of localCalendars) {
      if (!remoteCalendarIds.has(localCalendar.id)) {
        console.log(`[Sync] Calendar deleted on server: ${localCalendar.displayName}`);
        // remove tasks for this calendar
        const tasks = useTaskStore.getState().tasks.filter(t => t.calendarId === localCalendar.id);
        for (const task of tasks) {
          deleteTask(task.id);
        }
      }
    }

    // update account with new calendar list
    if (JSON.stringify(updatedCalendars) !== JSON.stringify(localCalendars)) {
      console.log(`[Sync] Updating account calendars: ${updatedCalendars.length} calendars`);
      updateAccount(accountId, { calendars: updatedCalendars });
    }

    return updatedCalendars;
  }, [updateAccount, deleteTask]);

  /**
   * ensure a tag exists by name, returns the tag ID
   */
  const ensureTagExists = useCallback((tagName: string): string => {
    const currentTags = useTaskStore.getState().tags;
    const existing = currentTags.find(
      t => t.name.toLowerCase() === tagName.toLowerCase()
    );
    
    if (existing) {
      return existing.id;
    }
    
    console.log(`[Sync] Creating tag: ${tagName}`);
    const newTag = addTag({
      name: tagName,
      color: generateTagColor(tagName),
    });
    return newTag.id;
  }, [addTag]);

  /**
   * sync a specific calendar - push local changes, then fetch from server
   */
  const syncCalendar = useCallback(async (calendarId: string) => {
    // get fresh accounts from store
    const currentAccounts = useTaskStore.getState().accounts;
    const account = currentAccounts.find(a => 
      a.calendars.some(c => c.id === calendarId)
    );
    
    if (!account) {
      console.error('[Sync] Calendar not found in any account, calendarId:', calendarId);
      return;
    }

    const calendar = account.calendars.find(c => c.id === calendarId);
    if (!calendar) {
      console.error('[Sync] Calendar not found');
      return;
    }

    // ensure we're connected
    if (!caldavService.isConnected(account.id)) {
      await caldavService.reconnect(account);
    }

    // STEP 0: Process pending deletions for this calendar
    const pendingDeletions = useTaskStore.getState().pendingDeletions;
    const calendarDeletions = pendingDeletions.filter(d => d.calendarId === calendarId);
    console.log(`[Sync] Found ${calendarDeletions.length} pending deletions for calendar`);
    
    for (const deletion of calendarDeletions) {
      try {
        console.log(`[Sync] Deleting task from server: ${deletion.href}`);
        await caldavService.deleteTask(account.id, { href: deletion.href } as any);
        clearPendingDeletion(deletion.uid);
        console.log(`[Sync] Successfully deleted task from server`);
      } catch (error) {
        console.error(`[Sync] Failed to delete task from server:`, error);
        // still clear the pending deletion to avoid infinite retries
        // the task may have already been deleted on the server
        clearPendingDeletion(deletion.uid);
      }
    }

    // get local tasks for this calendar
    const currentTasks = useTaskStore.getState().tasks;
    const localCalendarTasks = currentTasks.filter(t => t.calendarId === calendarId);

    // STEP 1: Push unsynced local tasks to server
    const unsyncedTasks = localCalendarTasks.filter(t => !t.synced);
    console.log(`[Sync] Found ${unsyncedTasks.length} unsynced local tasks to push`);
    
    for (const task of unsyncedTasks) {
      try {
        if (task.href) {
          // update existing task on server
          console.log(`[Sync] Updating task on server: ${task.title}`);
          const result = await caldavService.updateTask(account.id, task);
          if (result) {
            updateTask(task.id, { etag: result.etag, synced: true });
          }
        } else {
          // create new task on server
          console.log(`[Sync] Creating task on server: ${task.title}`);
          const result = await caldavService.createTask(account.id, calendar, task);
          if (result) {
            updateTask(task.id, { href: result.href, etag: result.etag, synced: true });
          }
        }
      } catch (error) {
        console.error(`[Sync] Failed to push task ${task.title}:`, error);
      }
    }

    // STEP 2: Fetch tasks from server
    const remoteTasks = await caldavService.fetchTasks(account.id, calendar);
    console.log(`[Sync] Fetched ${remoteTasks.length} tasks from ${calendar.displayName}`);

    // re-get local tasks (may have been updated by push)
    const updatedLocalTasks = useTaskStore.getState().tasks.filter(t => t.calendarId === calendarId);
    const localUids = new Set(updatedLocalTasks.map(t => t.uid));
    const remoteUids = new Set(remoteTasks.map(t => t.uid));

    // find new tasks from server (not in local)
    for (const remoteTask of remoteTasks) {
      if (!localUids.has(remoteTask.uid)) {
        // new task from server
        console.log(`[Sync] Adding new task from server: ${remoteTask.title}`);
        
        // extract category/tag from the task and create if needed
        // categoryId from CalDAV is the CATEGORIES property value (tag name)
        let tagIds: string[] = [];
        if (remoteTask.categoryId) {
          // CATEGORIES can be comma-separated
          const categoryNames = remoteTask.categoryId.split(',').map((s: string) => s.trim()).filter(Boolean);
          console.log(`[Sync] Task "${remoteTask.title}" has CATEGORIES:`, categoryNames);
          tagIds = categoryNames.map((name: string) => ensureTagExists(name));
          console.log(`[Sync] Created/found tag IDs:`, tagIds);
        }
        
        // add the task with tags
        addTask({
          ...remoteTask,
          tags: tagIds,
        });
      } else {
        // task exists locally - check if server version is newer
        const localTask = updatedLocalTasks.find(t => t.uid === remoteTask.uid);
        if (localTask) {
          // Check if tags need to be synced from server
          let remoteTagIds: string[] = [];
          if (remoteTask.categoryId) {
            const categoryNames = remoteTask.categoryId.split(',').map((s: string) => s.trim()).filter(Boolean);
            remoteTagIds = categoryNames.map((name: string) => ensureTagExists(name));
          }
          
          // Check if local task is missing tags that exist on server
          const localTagIds = localTask.tags || [];
          const tagsMatch = remoteTagIds.length === localTagIds.length && 
            remoteTagIds.every(id => localTagIds.includes(id));
          
          if (remoteTask.etag !== localTask.etag) {
            // only update from server if local task is synced (no local changes)
            // if local task has unsynced changes, prefer local (will push on next sync)
            if (localTask.synced) {
              console.log(`[Sync] Updating task from server: ${remoteTask.title} (sortOrder: ${remoteTask.sortOrder})`);
              
              updateTask(localTask.id, {
                ...remoteTask,
                id: localTask.id, // Keep local ID
                tags: remoteTagIds,
                synced: true,
              });
            } else {
              console.log(`[Sync] Skipping server update for ${remoteTask.title} - local changes pending`);
            }
          } else if (!tagsMatch && localTask.synced) {
            // etag matches but tags don't - sync tags without marking as unsynced
            console.log(`[Sync] Syncing tags for task: ${remoteTask.title}`);
            updateTask(localTask.id, {
              tags: remoteTagIds,
              synced: true, // Keep synced status
            });
          }
        }
      }
    }

    // find tasks deleted on server (in local but not in remote)
    for (const localTask of updatedLocalTasks) {
      if (localTask.synced && !remoteUids.has(localTask.uid)) {
        // task was deleted on server
        deleteTask(localTask.id);
      }
    }
  }, [addTask, updateTask, deleteTask, ensureTagExists, clearPendingDeletion]);

  /**
   * Sync all calendars for all accounts
   */
  const syncAll = useCallback(async () => {
    // skip if offline
    if (!navigator.onLine) {
      console.log('[Sync] Skipping sync - offline');
      setLastSyncError('You are offline. Changes will sync when you reconnect.');
      return;
    }

    console.log('[Sync] Starting syncAll...');
    console.log('[Sync] Accounts:', accounts.map(a => ({ id: a.id, name: a.name, calendars: a.calendars.length })));
    setIsSyncing(true);
    setLastSyncError(null);

    try {
      await reconnectAccounts();

      // get fresh accounts from store
      let freshAccounts = useTaskStore.getState().accounts;
      console.log('[Sync] Fresh accounts after reconnect:', freshAccounts.map(a => ({ id: a.id, name: a.name, calendars: a.calendars.length })));

      // STEP 1: Sync calendars for each account (add/remove/update calendars)
      for (const account of freshAccounts) {
        console.log(`[Sync] Syncing calendars for account: ${account.name}`);
        try {
          await syncCalendarsForAccount(account.id);
        } catch (error) {
          console.error(`[Sync] Failed to sync calendars for ${account.name}:`, error);
        }
      }

      // re-fetch accounts after calendar sync (calendars may have been added/removed)
      freshAccounts = useTaskStore.getState().accounts;
      console.log('[Sync] Accounts after calendar sync:', freshAccounts.map(a => ({ id: a.id, name: a.name, calendars: a.calendars.length })));

      // STEP 2: Sync tasks for each calendar
      for (const account of freshAccounts) {
        console.log(`[Sync] Processing account: ${account.name} with ${account.calendars.length} calendars`);
        for (const calendar of account.calendars) {
          console.log(`[Sync] Syncing tasks for calendar: ${calendar.displayName} (${calendar.id})`);
          try {
            await syncCalendar(calendar.id);
          } catch (error) {
            console.error(`[Sync] Failed to sync calendar ${calendar.displayName}:`, error);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setLastSyncError(message);
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
      setLastSyncTime(new Date());
    }
  }, [accounts, reconnectAccounts, syncCalendar, syncCalendarsForAccount]);

  /**
   * Push a task to the server
   */
  const pushTask = useCallback(async (task: Task) => {
    const account = accounts.find(a => a.id === task.accountId);
    if (!account) return;

    const calendar = account.calendars.find(c => c.id === task.calendarId);
    if (!calendar) return;

    if (!caldavService.isConnected(account.id)) {
      await caldavService.reconnect(account);
    }

    if (task.href) {
      // update existing
      const result = await caldavService.updateTask(account.id, task);
      if (result) {
        updateTask(task.id, { etag: result.etag, synced: true });
      }
    } else {
      // create new
      const result = await caldavService.createTask(account.id, calendar, task);
      if (result) {
        updateTask(task.id, { href: result.href, etag: result.etag, synced: true });
      }
    }
  }, [accounts, updateTask]);

  /**
   * Delete a task from the server
   */
  const removeTaskFromServer = useCallback(async (task: Task) => {
    if (!task.href) return true; // Not on server yet

    const account = accounts.find(a => a.id === task.accountId);
    if (!account) return false;

    if (!caldavService.isConnected(account.id)) {
      await caldavService.reconnect(account);
    }

    return caldavService.deleteTask(account.id, task);
  }, [accounts]);

  // initial sync on mount
  useEffect(() => {
    if (accounts.length > 0) {
      syncAll();
    }
  }, []); // Only run once on mount

  // sync when active calendar changes
  useEffect(() => {
    if (activeCalendarId) {
      syncCalendar(activeCalendarId).catch(console.error);
    }
  }, [activeCalendarId, syncCalendar]);

  // auto-sync interval
  useEffect(() => {
    // clear existing interval
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
      autoSyncIntervalRef.current = null;
    }

    // set up new interval if autosync is enabled
    if (autoSync && syncInterval > 0 && accounts.length > 0) {
      console.log(`[Sync] Setting up auto-sync every ${syncInterval} minutes`);
      autoSyncIntervalRef.current = setInterval(() => {
        if (!isOffline && !isSyncing) {
          console.log('[Sync] Auto-sync triggered');
          syncAll();
        }
      }, syncInterval * 60 * 1000);
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [autoSync, syncInterval, accounts.length, isOffline]);

  return {
    isSyncing,
    isOffline,
    lastSyncError,
    lastSyncTime,
    syncAll,
    syncCalendar,
    pushTask,
    removeTaskFromServer,
  };
}
