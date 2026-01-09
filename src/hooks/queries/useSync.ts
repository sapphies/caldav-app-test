/**
 * TanStack Query-based sync hook
 * Handles syncing CalDAV data using mutations
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import * as taskData from '@/lib/taskData';
import { useSettingsStore } from '@/store/settingsStore';
import { caldavService } from '@/lib/caldav';
import { Task, Calendar } from '@/types';
import { useOffline } from '../useOffline';
import { generateTagColor } from '@/utils/color';
import { createLogger } from '@/lib/logger';

const log = createLogger('Sync', '#06b6d4');

export function useSyncQuery() {
  const queryClient = useQueryClient();
  const { autoSync, syncInterval } = useSettingsStore();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const pendingSyncRef = useRef(false);
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get current accounts from data layer
  const getAccounts = () => taskData.getAllAccounts();

  // Handle online/offline status
  const { isOffline } = useOffline({
    onOnline: () => {
      log.info('Back online, triggering sync...');
      pendingSyncRef.current = true;
      syncAll();
    },
    onOffline: () => {
      log.info('Going offline, changes will be synced when back online');
    },
  });

  /**
   * Reconnect all accounts on app startup
   */
  const reconnectAccounts = useCallback(async () => {
    const accounts = getAccounts();
    for (const account of accounts) {
      if (!caldavService.isConnected(account.id)) {
        try {
          await caldavService.reconnect(account);
          log.info(`Reconnected to account: ${account.name}`);
        } catch (error) {
          log.error(`Failed to reconnect account ${account.name}:`, error);
        }
      }
    }
  }, []);

  /**
   * Sync calendars for an account - add new, remove deleted, update properties
   */
  const syncCalendarsForAccount = useCallback(async (accountId: string) => {
    const accounts = getAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    // Ensure we're connected
    if (!caldavService.isConnected(accountId)) {
      await caldavService.reconnect(account);
    }

    const remoteCalendars = await caldavService.fetchCalendars(accountId);
    log.info(`Found ${remoteCalendars.length} calendars on server for ${account.name}`);

    const localCalendars = account.calendars;
    const remoteCalendarIds = new Set(remoteCalendars.map(c => c.id));

    // Build updated calendar list
    const updatedCalendars: Calendar[] = [];

    // Add/update calendars from server
    for (const remoteCalendar of remoteCalendars) {
      const localCalendar = localCalendars.find(c => c.id === remoteCalendar.id);
      
      if (localCalendar) {
        // Calendar exists - check if properties changed
        if (localCalendar.displayName !== remoteCalendar.displayName ||
            localCalendar.color !== remoteCalendar.color ||
            localCalendar.ctag !== remoteCalendar.ctag ||
            localCalendar.syncToken !== remoteCalendar.syncToken) {
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
        // New calendar from server
        updatedCalendars.push(remoteCalendar);
      }
    }

    // track if we need to redirect to All Tasks
    const currentUIState = taskData.getUIState();
    let needsRedirectToAllTasks = false;

    // Remove calendars that were deleted on server
    for (const localCalendar of localCalendars) {
      if (!remoteCalendarIds.has(localCalendar.id)) {
        // check if this was the active calendar
        if (currentUIState.activeCalendarId === localCalendar.id) {
          needsRedirectToAllTasks = true;
        }
        // Remove tasks for this calendar
        const tasks = taskData.getTasksByCalendar(localCalendar.id);
        for (const task of tasks) {
          taskData.deleteTask(task.id);
        }
      }
    }

    // Update account with new calendar list
    if (JSON.stringify(updatedCalendars) !== JSON.stringify(localCalendars)) {
      taskData.updateAccount(accountId, { calendars: updatedCalendars });
    }

    // if active calendar was deleted, redirect to All Tasks
    if (needsRedirectToAllTasks) {
      log.info('Active calendar was deleted on server, redirecting to All Tasks');
      taskData.setAllTasksView();
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
    }

    return updatedCalendars;
  }, [queryClient]);

  /**
   * Ensure a tag exists by name, returns the tag ID
   */
  const ensureTagExists = useCallback((tagName: string): string => {
    const currentTags = taskData.getAllTags();
    const existing = currentTags.find(
      t => t.name.toLowerCase() === tagName.toLowerCase()
    );
    
    if (existing) {
      return existing.id;
    }
    
    const newTag = taskData.createTag({
      name: tagName,
      color: generateTagColor(tagName),
    });
    return newTag.id;
  }, []);

  /**
   * Sync a specific calendar - push local changes, then fetch from server
   */
  const syncCalendar = useCallback(async (calendarId: string) => {
    const accounts = getAccounts();
    const account = accounts.find(a => 
      a.calendars.some(c => c.id === calendarId)
    );
    
    if (!account) {
      log.error('Calendar not found in any account, calendarId:', calendarId);
      return;
    }

    const calendar = account.calendars.find(c => c.id === calendarId);
    if (!calendar) {
      log.error('Calendar not found');
      return;
    }

    // Ensure we're connected
    if (!caldavService.isConnected(account.id)) {
      await caldavService.reconnect(account);
    }

    // STEP 0: Process pending deletions for this calendar
    const pendingDeletions = taskData.getPendingDeletions();
    const calendarDeletions = pendingDeletions.filter(d => d.calendarId === calendarId);
    
    for (const deletion of calendarDeletions) {
      try {
        await caldavService.deleteTask(account.id, { href: deletion.href } as any);
        taskData.clearPendingDeletion(deletion.uid);
      } catch (error) {
        log.error(`Failed to delete task from server:`, error);
        // Still clear the pending deletion to avoid infinite retries
        taskData.clearPendingDeletion(deletion.uid);
      }
    }

    // Get local tasks for this calendar
    const localCalendarTasks = taskData.getTasksByCalendar(calendarId);

    // STEP 1: Push unsynced local tasks to server
    const unsyncedTasks = localCalendarTasks.filter(t => !t.synced);
    
    for (const task of unsyncedTasks) {
      try {
        if (task.href) {
          // Update existing task on server
          const result = await caldavService.updateTask(account.id, task);
          if (result) {
            taskData.updateTask(task.id, { etag: result.etag, synced: true });
          }
        } else {
          // Create new task on server
          const result = await caldavService.createTask(account.id, calendar, task);
          if (result) {
            taskData.updateTask(task.id, { href: result.href, etag: result.etag, synced: true });
          }
        }
      } catch (error) {
        log.error(`Failed to push task ${task.title}:`, error);
      }
    }

    // STEP 2: Fetch tasks from server
    const remoteTasks = await caldavService.fetchTasks(account.id, calendar);
    log.info(`Fetched ${remoteTasks.length} tasks from ${calendar.displayName}`);

    // Re-get local tasks (may have been updated by push)
    const updatedLocalTasks = taskData.getTasksByCalendar(calendarId);
    const localUids = new Set(updatedLocalTasks.map(t => t.uid));
    const remoteUids = new Set(remoteTasks.map(t => t.uid));

    // Find new tasks from server (not in local)
    for (const remoteTask of remoteTasks) {
      if (!localUids.has(remoteTask.uid)) {
        // New task from server
        
        // Extract category/tag from the task and create if needed
        let tagIds: string[] = [];
        if (remoteTask.categoryId) {
          const categoryNames = remoteTask.categoryId.split(',').map((s: string) => s.trim()).filter(Boolean);
          tagIds = categoryNames.map((name: string) => ensureTagExists(name));
        }
        
        // Add the task with tags
        taskData.createTask({
          ...remoteTask,
          tags: tagIds,
        });
      } else {
        // Task exists locally - check if server version is newer
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
            // Only update from server if local task is synced (no local changes)
            if (localTask.synced) {
              taskData.updateTask(localTask.id, {
                ...remoteTask,
                id: localTask.id, // Keep local ID
                tags: remoteTagIds,
                synced: true,
              });
            }
          } else if (!tagsMatch && localTask.synced) {
            // Etag matches but tags don't - sync tags without marking as unsynced
            taskData.updateTask(localTask.id, {
              tags: remoteTagIds,
              synced: true,
            });
          }
        }
      }
    }

    // Find tasks deleted on server (in local but not in remote)
    for (const localTask of updatedLocalTasks) {
      if (localTask.synced && !remoteUids.has(localTask.uid)) {
        // Task was deleted on server
        taskData.deleteTask(localTask.id);
      }
    }
    
    // Invalidate queries after sync
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
  }, [queryClient, ensureTagExists]);

  /**
   * Sync all calendars for all accounts
   */
  const syncAll = useCallback(async () => {
    // Skip if offline
    if (!navigator.onLine) {
      log.info('Skipping sync - offline');
      setLastSyncError('You are offline. Changes will sync when you reconnect.');
      return;
    }

    log.info('Starting sync...');
    setIsSyncing(true);
    setLastSyncError(null);

    try {
      await reconnectAccounts();

      // Get fresh accounts from data layer
      let freshAccounts = getAccounts();

      // STEP 1: Sync calendars for each account (add/remove/update calendars)
      for (const account of freshAccounts) {
        try {
          await syncCalendarsForAccount(account.id);
        } catch (error) {
          log.error(`Failed to sync calendars for ${account.name}:`, error);
        }
      }

      // Re-fetch accounts after calendar sync (calendars may have been added/removed)
      freshAccounts = getAccounts();

      // STEP 2: Sync tasks for each calendar
      for (const account of freshAccounts) {
        for (const calendar of account.calendars) {
          try {
            await syncCalendar(calendar.id);
          } catch (error) {
            log.error(`Failed to sync calendar ${calendar.displayName}:`, error);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setLastSyncError(message);
      log.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
      setLastSyncTime(new Date());
    }
  }, [reconnectAccounts, syncCalendar, syncCalendarsForAccount]);

  /**
   * Push a task to the server
   */
  const pushTask = useCallback(async (task: Task) => {
    const accounts = getAccounts();
    const account = accounts.find(a => a.id === task.accountId);
    if (!account) return;

    const calendar = account.calendars.find(c => c.id === task.calendarId);
    if (!calendar) return;

    if (!caldavService.isConnected(account.id)) {
      await caldavService.reconnect(account);
    }

    if (task.href) {
      // Update existing
      const result = await caldavService.updateTask(account.id, task);
      if (result) {
        taskData.updateTask(task.id, { etag: result.etag, synced: true });
      }
    } else {
      // Create new
      const result = await caldavService.createTask(account.id, calendar, task);
      if (result) {
        taskData.updateTask(task.id, { href: result.href, etag: result.etag, synced: true });
      }
    }
    
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  }, [queryClient]);

  /**
   * Delete a task from the server
   */
  const removeTaskFromServer = useCallback(async (task: Task) => {
    if (!task.href) return true; // Not on server yet

    const accounts = getAccounts();
    const account = accounts.find(a => a.id === task.accountId);
    if (!account) return false;

    if (!caldavService.isConnected(account.id)) {
      await caldavService.reconnect(account);
    }

    return caldavService.deleteTask(account.id, task);
  }, []);

  // Initial sync on mount
  useEffect(() => {
    const accounts = getAccounts();
    if (accounts.length > 0) {
      syncAll();
    }
  }, []); // Only run once on mount

  // Sync when active calendar changes
  const activeCalendarId = taskData.getUIState().activeCalendarId;
  useEffect(() => {
    if (activeCalendarId) {
      syncCalendar(activeCalendarId).catch(error => log.error('Active calendar sync failed:', error));
    }
  }, [activeCalendarId, syncCalendar]);

  // Auto-sync interval
  useEffect(() => {
    // Clear existing interval
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
      autoSyncIntervalRef.current = null;
    }

    const accounts = getAccounts();
    // Set up new interval if autosync is enabled
    if (autoSync && syncInterval > 0 && accounts.length > 0) {
      autoSyncIntervalRef.current = setInterval(() => {
        if (!isOffline && !isSyncing) {
          syncAll();
        }
      }, syncInterval * 60 * 1000);
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [autoSync, syncInterval, isOffline, isSyncing, syncAll]);

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
