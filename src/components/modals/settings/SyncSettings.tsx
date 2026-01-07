import { useSettingsStore } from '@/store/settingsStore';

export function SyncSettings() {
  const { 
    autoSync, 
    setAutoSync, 
    syncInterval, 
    setSyncInterval,
    syncOnStartup,
    setSyncOnStartup,
  } = useSettingsStore();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Sync</h3>
      <div className="space-y-4 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm text-surface-700 dark:text-surface-300">Auto-sync</span>
            <p className="text-xs text-surface-500 dark:text-surface-400">Automatically sync with CalDAV servers</p>
          </div>
          <input 
            type="checkbox" 
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
            className="rounded border-surface-300 dark:border-surface-600" 
          />
        </label>

        {autoSync && (
          <div>
            <label className="block text-sm text-surface-600 dark:text-surface-400 mb-2">Sync interval</label>
            <select
              value={syncInterval.toString()}
              onChange={(e) => setSyncInterval(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300"
            >
              <option value="1">Every 1 minute</option>
              <option value="5">Every 5 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every hour</option>
            </select>
          </div>
        )}

        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm text-surface-700 dark:text-surface-300">Sync on startup</span>
            <p className="text-xs text-surface-500 dark:text-surface-400">Sync immediately when app launches</p>
          </div>
          <input 
            type="checkbox" 
            checked={syncOnStartup}
            onChange={(e) => setSyncOnStartup(e.target.checked)}
            className="rounded border-surface-300 dark:border-surface-600" 
          />
        </label>
      </div>
    </div>
  );
}
