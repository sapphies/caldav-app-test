import { useSettingsStore } from '@/store/settingsStore';
import { isMacPlatform } from '@/utils/misc';

export function NotificationSettings() {
  const { 
    notifications,
    setNotifications,
  } = useSettingsStore();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Notifications</h3>
      <div className="space-y-4 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm text-surface-700 dark:text-surface-300">Enable notifications</span>
              <p className="text-xs text-surface-500 dark:text-surface-400">Get notified for task reminders and due dates</p>
            </div>
            <input 
              type="checkbox" 
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              className="rounded border-surface-300" 
            />
          </label>
        </div>

        {isMacPlatform() && (
          <div className="p-3 bg-surface-200 dark:bg-surface-700 rounded-lg">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              On macOS, you might need to allow notifications for this app when prompted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
