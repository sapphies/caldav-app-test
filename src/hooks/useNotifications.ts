import { useEffect, useRef } from 'react';
import { useTasks } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settingsStore';
import { isPast, differenceInMinutes } from 'date-fns';

// check if we're in a Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
}

async function showNotification(options: NotificationOptions): Promise<void> {
  if (isTauri) {
    try {
      // dynamic import for Tauri notification plugin
      const notification = await import('@tauri-apps/plugin-notification');
      const { isPermissionGranted, requestPermission, sendNotification } = notification;
      
      let permissionGranted = await isPermissionGranted();
      
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      
      if (permissionGranted) {
        sendNotification({
          title: options.title,
          body: options.body,
        });
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  } else {
    // browser fallback using Web Notifications API
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(options.title, {
          body: options.body,
          icon: options.icon,
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(options.title, {
            body: options.body,
            icon: options.icon,
          });
        }
      }
    }
  }
}

/**
 * hook that monitors tasks and shows notifications for due tasks and reminders
 */
export function useNotifications() {
  const { data: tasks = [] } = useTasks();
  const { notifications, notifyBefore } = useSettingsStore();
  const notifiedTasksRef = useRef<Set<string>>(new Set());
  const notifiedRemindersRef = useRef<Set<string>>(new Set());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!notifications) {
      // notifications disabled, clear interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkDueTasks = () => {
      const now = new Date();

      for (const task of tasks) {
        // skip completed tasks
        if (task.completed) continue;

        // Check reminders (VALARM)
        if (task.reminders && task.reminders.length > 0) {
          for (const reminder of task.reminders) {
            const reminderKey = `reminder-${task.id}-${reminder.id}`;
            
            // skip if we already notified about this reminder
            if (notifiedRemindersRef.current.has(reminderKey)) continue;
            
            const reminderDate = new Date(reminder.trigger);
            const minutesUntilReminder = differenceInMinutes(reminderDate, now);
            
            // Fire reminder when it's time (within 1 minute window)
            if (minutesUntilReminder <= 0 && minutesUntilReminder >= -1) {
              showNotification({
                title: 'Task Reminder',
                body: task.title,
              });
              notifiedRemindersRef.current.add(reminderKey);
            }
          }
        }

        // Check due dates
        if (!task.dueDate) continue;

        const dueDate = new Date(task.dueDate);
        const taskKey = `due-${task.id}-${dueDate.getTime()}`;

        // skip if we already notified about this task
        if (notifiedTasksRef.current.has(taskKey)) continue;

        // check if the task is due within the notification window
        const minutesUntilDue = differenceInMinutes(dueDate, now);
        
        if (minutesUntilDue <= notifyBefore && minutesUntilDue >= 0) {
          // task is due soon, show notification
          let timeText: string;
          if (minutesUntilDue === 0) {
            timeText = 'now';
          } else if (minutesUntilDue < 60) {
            timeText = `in ${minutesUntilDue} minute${minutesUntilDue === 1 ? '' : 's'}`;
          } else {
            const hours = Math.floor(minutesUntilDue / 60);
            timeText = `in ${hours} hour${hours === 1 ? '' : 's'}`;
          }

          showNotification({
            title: `Task Due ${timeText}`,
            body: task.title,
          });

          notifiedTasksRef.current.add(taskKey);
        } else if (isPast(dueDate) && !notifiedTasksRef.current.has(taskKey)) {
          // task is overdue, show notification
          showNotification({
            title: 'Task Overdue',
            body: task.title,
          });

          notifiedTasksRef.current.add(taskKey);
        }
      }

      // clean up old notification records (keep only recent ones)
      if (notifiedTasksRef.current.size > 1000) {
        notifiedTasksRef.current.clear();
      }
      if (notifiedRemindersRef.current.size > 1000) {
        notifiedRemindersRef.current.clear();
      }
    };

    // check immediately
    checkDueTasks();

    // check every minute
    checkIntervalRef.current = setInterval(checkDueTasks, 60 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [tasks, notifications, notifyBefore]);
}
