import { useState } from 'react';
import X from 'lucide-react/icons/x';
import Keyboard from 'lucide-react/icons/keyboard';
import RefreshCw from 'lucide-react/icons/refresh-cw';
import Palette from 'lucide-react/icons/palette';
import Info from 'lucide-react/icons/info';
import Moon from 'lucide-react/icons/moon';
import Sun from 'lucide-react/icons/sun';
import Monitor from 'lucide-react/icons/monitor';
import Download from 'lucide-react/icons/download';
import Upload from 'lucide-react/icons/upload';
import Bell from 'lucide-react/icons/bell';
import Database from 'lucide-react/icons/database';
import Settings from 'lucide-react/icons/settings';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore, type Theme, type StartOfWeek } from '@/store/settingsStore';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import { downloadFile } from '../../utils/file';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'general' | 'notifications' | 'sync' | 'data' | 'shortcuts' | 'about';

const accentColors = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
];

const shortcuts = [
  { keys: ['⌘', 'N'], description: 'Create new task' },
  { keys: ['⌘', 'F'], description: 'Search tasks' },
  { keys: ['⌘', 'R'], description: 'Sync with server' },
  { keys: ['⌘', ','], description: 'Open settings' },
  { keys: ['Escape'], description: 'Close editor/modal' },
  { keys: ['⌘', 'Enter'], description: 'Save and close task' },
  { keys: ['⌘', 'Backspace'], description: 'Delete selected task' },
  { keys: ['↑', '↓'], description: 'Navigate tasks' },
  { keys: ['Space'], description: 'Toggle task complete' },
];

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const { accounts } = useTaskStore();

  // handle ESC key to close modal
  useModalEscapeKey(onClose);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'sync', label: 'Sync', icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'data', label: 'Data', icon: <Database className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div 
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-surface-200 dark:border-surface-700 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-6 overflow-y-auto overscroll-contain">
            {activeTab === 'appearance' && <AppearanceSettings />}
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'sync' && <SyncSettings accounts={accounts} />}
            {activeTab === 'data' && <DataSettings />}
            {activeTab === 'shortcuts' && <ShortcutsSettings />}
            {activeTab === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { 
    theme, 
    setTheme, 
    accentColor, 
    setAccentColor,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Theme</h3>
        <div className="flex gap-2">
          {[
            { value: 'light' as Theme, icon: <Sun className="w-4 h-4" />, label: 'Light' },
            { value: 'dark' as Theme, icon: <Moon className="w-4 h-4" />, label: 'Dark' },
            { value: 'system' as Theme, icon: <Monitor className="w-4 h-4" />, label: 'System' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
                theme === option.value
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 text-surface-600 dark:text-surface-400'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Accent Color</h3>
        <div className="flex gap-2">
          {accentColors.map((color) => (
            <button
              key={color.value}
              onClick={() => setAccentColor(color.value)}
              title={color.name}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                accentColor === color.value
                  ? 'border-surface-800 dark:border-white scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color.value }}
            />
          ))}
        </div>
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
          Select an accent color to personalize the app.
        </p>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const { 
    showCompletedByDefault,
    setShowCompletedByDefault,
    confirmBeforeDelete,
    setConfirmBeforeDelete,
    startOfWeek,
    setStartOfWeek,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Task Defaults</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-surface-600 dark:text-surface-400">Show completed tasks by default</span>
            <input 
              type="checkbox" 
              checked={showCompletedByDefault}
              onChange={(e) => setShowCompletedByDefault(e.target.checked)}
              className="rounded border-surface-300" 
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Confirmations</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-surface-600 dark:text-surface-400">Confirm before deleting tasks</span>
            <input 
              type="checkbox" 
              checked={confirmBeforeDelete}
              onChange={(e) => setConfirmBeforeDelete(e.target.checked)}
              className="rounded border-surface-300" 
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Calendar</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-surface-600 dark:text-surface-400">Week starts on</span>
          <div className="flex gap-2">
            {[
              { value: 'sunday' as StartOfWeek, label: 'Sunday' },
              { value: 'monday' as StartOfWeek, label: 'Monday' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStartOfWeek(option.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  startOfWeek === option.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const { 
    notifications,
    setNotifications,
    notifyBefore,
    setNotifyBefore,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Task Reminders</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm text-surface-700 dark:text-surface-300">Enable notifications</span>
              <p className="text-xs text-surface-500 dark:text-surface-400">Get notified when tasks are due</p>
            </div>
            <input 
              type="checkbox" 
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              className="rounded border-surface-300" 
            />
          </label>

          {notifications && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-600 dark:text-surface-400">Notify before due</span>
              <select
                value={notifyBefore}
                onChange={(e) => setNotifyBefore(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 border-0"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={1440}>1 day</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
        <p className="text-sm text-surface-600 dark:text-surface-400">
          Notifications will appear for tasks with due dates. Make sure to allow notifications when prompted by your system.
        </p>
      </div>
    </div>
  );
}

function DataSettings() {
  const { exportSettings, importSettings } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Settings Backup</h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
          Export your settings to a file for backup or transfer to another device.
        </p>
        <div className="flex gap-2">
          <button
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
              } catch (e) {
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
              } catch (e) {
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

      <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
        <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">What's included?</h4>
        <ul className="text-sm text-surface-600 dark:text-surface-400 space-y-1">
          <li>• Appearance settings (theme, accent color)</li>
          <li>• Behavior preferences</li>
          <li>• Notification settings</li>
          <li>• Sync preferences</li>
        </ul>
        <p className="text-xs text-surface-500 dark:text-surface-400 mt-3">
          Note: Account credentials and task data are not included in settings export.
        </p>
      </div>
    </div>
  );
}

function SyncSettings({ accounts }: { accounts: { id: string; name: string }[] }) {
  const { 
    autoSync, 
    setAutoSync, 
    syncInterval, 
    setSyncInterval,
    syncOnStartup,
    setSyncOnStartup,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Sync Settings</h3>
        
        <div className="space-y-4">
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

      <div>
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Connected Accounts</h3>
        
        {accounts.length === 0 ? (
          <p className="text-sm text-surface-500 dark:text-surface-400">No accounts connected.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-700 rounded-lg"
              >
                <span className="text-sm text-surface-700 dark:text-surface-300">{account.name}</span>
                <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                  Connected
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShortcutsSettings() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200">Keyboard Shortcuts</h3>
      
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-700 last:border-0"
          >
            <span className="text-sm text-surface-600 dark:text-surface-400">{shortcut.description}</span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((key, keyIndex) => (
                <span key={keyIndex}>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded text-xs font-mono text-surface-700 dark:text-surface-300">
                    {key}
                  </kbd>
                  {keyIndex < shortcut.keys.length - 1 && (
                    <span className="text-surface-400 mx-1">+</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-surface-500 dark:text-surface-400 mt-4">
        On Windows/Linux, use Ctrl instead of ⌘.
      </p>
    </div>
  );
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-surface-800 dark:text-surface-200 mb-1">caldav app test</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">beta</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-2">about</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            a work in progress caldav compatible task management client for desktop
          </p>
        </div>

        <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-2">credits</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            made by sapphic angels
          </p>
        </div>
      </div>
    </div>
  );
}
