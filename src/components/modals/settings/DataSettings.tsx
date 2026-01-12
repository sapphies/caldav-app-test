import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import ChevronDown from 'lucide-react/icons/chevron-down';
import Download from 'lucide-react/icons/download';
import Upload from 'lucide-react/icons/upload';
import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { downloadFile } from '@/utils/file';

export function DataSettings() {
  const { exportSettings, importSettings } = useSettingsStore();
  const [showIncluded, setShowIncluded] = useState(false);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Data</h3>
      <div className="space-y-4 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <div>
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">
            Settings Backup
          </h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
            Export your settings to a file for backup or transfer to another device.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                const json = exportSettings();
                try {
                  const path = await save({
                    defaultPath: 'caldav-settings.json',
                    filters: [{ name: 'JSON', extensions: ['json'] }],
                  });
                  if (path) {
                    await writeTextFile(path, json);
                  }
                } catch (_e) {
                  // fallback to browser download
                  downloadFile(json, 'caldav-settings.json', 'application/json');
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Settings
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const path = await open({
                    filters: [{ name: 'JSON', extensions: ['json'] }],
                    multiple: false,
                  });
                  if (path) {
                    const content = await readTextFile(path as string);
                    const success = importSettings(content);
                    if (!success) {
                      alert('Failed to import settings. Invalid format.');
                    }
                  }
                } catch (_e) {
                  // fallback to browser file input
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (event) => {
                    const file = (event.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const content = await file.text();
                      const success = importSettings(content);
                      if (!success) {
                        alert('Failed to import settings. Invalid format.');
                      }
                    }
                  };
                  input.click();
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Settings
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
          <button
            type="button"
            onClick={() => setShowIncluded(!showIncluded)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            <span>What's included?</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showIncluded ? 'rotate-180' : ''}`}
            />
          </button>

          {showIncluded && (
            <div className="px-4 pb-4 space-y-2 text-sm text-surface-600 dark:text-surface-400">
              <ul className="space-y-1">
                <li>• Appearance settings (theme, accent color)</li>
                <li>• Behavior preferences</li>
                <li>• Notification settings</li>
                <li>• Sync preferences</li>
              </ul>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Note: Account credentials and task data are not included in settings export.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
