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
import User from 'lucide-react/icons/user';
import ChevronDown from 'lucide-react/icons/chevron-down';
import RotateCcw from 'lucide-react/icons/rotate-ccw';
import Trash2 from 'lucide-react/icons/trash-2';
import ListTodo from 'lucide-react/icons/list-todo';
import Pencil from 'lucide-react/icons/pencil';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { useAccounts, useTags, useDeleteAccount } from '@/hooks/queries';
import { useSettingsStore, type Theme, type StartOfWeek, type KeyboardShortcut, type SubtaskDeletionBehavior } from '@/store/settingsStore';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { downloadFile } from '../../utils/file';
import { getMetaKeyLabel, getAltKeyLabel, getShiftKeyLabel } from '../../utils/keyboard';
import { KeyboardShortcutModal } from './KeyboardShortcutModal';
import type { Account, Priority } from '@/types';
import packageJson from '../../../package.json';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsCategory = 'general' | 'account' | 'about';
type SettingsSubtab =
  | 'behavior'
  | 'appearance'
  | 'notifications'
  | 'shortcuts'
  | 'defaults'
  | 'connections'
  | 'sync'
  | 'data'
  | 'version';

type SettingsSubtabInfo = { id: SettingsSubtab; label: string; icon: React.ReactNode };

const accentColors = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
];

const metaKeyLabel = getMetaKeyLabel();

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [activeSubtabs, setActiveSubtabs] = useState<Record<SettingsCategory, SettingsSubtab>>({
    general: 'behavior',
    account: 'connections',
    about: 'version',
  });
  const { data: accounts = [] } = useAccounts();

  // handle ESC key to close modal
  useModalEscapeKey(onClose);

  const categories: {
    id: SettingsCategory;
    label: string;
    icon: React.ReactNode;
    description: string;
    subtabs: SettingsSubtabInfo[];
  }[] = [
    {
      id: 'general',
      label: 'General',
      icon: <Settings className="w-4 h-4" />,
      description: 'Behavior, appearance, notifications, shortcuts',
      subtabs: [
        { id: 'behavior', label: 'Behavior', icon: <Settings className="w-4 h-4" /> },
        { id: 'defaults', label: 'Task Defaults', icon: <ListTodo className="w-4 h-4" /> },
        { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
        { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      icon: <User className="w-4 h-4" />,
      description: 'Connections, sync, data',
      subtabs: [
        { id: 'connections', label: 'Connections', icon: <User className="w-4 h-4" /> },
        { id: 'sync', label: 'Sync', icon: <RefreshCw className="w-4 h-4" /> },
        { id: 'data', label: 'Data', icon: <Database className="w-4 h-4" /> },
      ],
    },
    {
      id: 'about',
      label: 'About',
      icon: <Info className="w-4 h-4" />,
      description: 'Version',
      subtabs: [{ id: 'version', label: 'Version', icon: <Info className="w-4 h-4" /> }],
    },
  ];

  const currentSubtab = activeSubtabs[activeCategory];

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
          <div className="w-56 border-r border-surface-200 dark:border-surface-700 p-3 space-y-4 bg-white dark:bg-surface-800 rounded-l-xl">
            {categories.map((category) => (
              <div key={category.id} className="space-y-2">
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
                  {category.label}
                </p>
                <div className="space-y-1">
                  {category.subtabs.map((tab) => {
                    const isActiveCategory = activeCategory === category.id;
                    const isActiveTab = isActiveCategory && activeSubtabs[category.id] === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveCategory(category.id);
                          setActiveSubtabs((prev) => ({
                            ...prev,
                            [category.id]: tab.id,
                          }));
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                          isActiveTab
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-400'
                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 border border-transparent'
                        }`}
                      >
                        <span
                          className={`shrink-0 ${
                            isActiveTab
                              ? 'text-primary-600 dark:text-primary-300'
                              : 'text-surface-500 dark:text-surface-400'
                          }`}
                        >
                          {tab.icon}
                        </span>
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

            <div className="flex-1 p-6 overflow-y-auto overscroll-contain">
            {activeCategory === 'general' && (
              <div className="space-y-6">
                {currentSubtab === 'behavior' && <BehaviorSettings />}
                {currentSubtab === 'defaults' && <TaskDefaultsSettings />}
                {currentSubtab === 'appearance' && <AppearanceSettings />}
                {currentSubtab === 'notifications' && <NotificationSettings />}
                {currentSubtab === 'shortcuts' && <ShortcutsSettings />}
              </div>
            )}

            {activeCategory === 'account' && (
              <div className="space-y-6">
                {currentSubtab === 'connections' && <ConnectionsSettings accounts={accounts} />}
                {currentSubtab === 'sync' && <SyncSettings />}
                {currentSubtab === 'data' && <DataSettings />}
              </div>
            )}

            {activeCategory === 'about' && currentSubtab === 'version' && <AboutSettings />}
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
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Appearance</h3>
      <div className="space-y-6 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <div>
          <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Theme</h4>
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
          <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Accent Color</h4>
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
        </div>
      </div>
    </div>
  );
}

function BehaviorSettings() {
  const { 
    confirmBeforeDelete,
    setConfirmBeforeDelete,
    deleteSubtasksWithParent,
    setDeleteSubtasksWithParent,
    startOfWeek,
    setStartOfWeek,
    defaultCalendarId,
    setDefaultCalendarId,
  } = useSettingsStore();
  const { data: accounts = [] } = useAccounts();
  
  // Get all calendars from all accounts
  const allCalendars = accounts.flatMap(account => 
    account.calendars.map(cal => ({
      ...cal,
      accountName: account.name,
    }))
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Behavior</h3>
      <div className="space-y-4 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <label className="flex items-center justify-between">
          <span className="text-sm text-surface-600 dark:text-surface-400">Confirm before deleting tasks</span>
          <input 
            type="checkbox" 
            checked={confirmBeforeDelete}
            onChange={(e) => setConfirmBeforeDelete(e.target.checked)}
            className="rounded border-surface-300" 
          />
        </label>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-700 dark:text-surface-300">When deleting a task with subtasks</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">Choose what happens to subtasks</p>
          </div>
          <select
            value={deleteSubtasksWithParent}
            onChange={(e) => setDeleteSubtasksWithParent(e.target.value as SubtaskDeletionBehavior)}
            className="px-3 py-1.5 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300"
          >
            <option value="delete">Delete all subtasks</option>
            <option value="keep">Keep subtasks</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-700 dark:text-surface-300">Week starts on</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">Choose how dates are shown in calendars</p>
          </div>
          <select
            value={startOfWeek}
            onChange={(e) => setStartOfWeek(e.target.value as StartOfWeek)}
            className="px-3 py-1.5 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300"
          >
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </div>

        {allCalendars.length > 0 && (
          <div>
            <div className="mb-2">
              <p className="text-sm text-surface-700 dark:text-surface-300">Default calendar for new tasks</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Used when creating tasks from "All Tasks" view</p>
            </div>
            <select
              value={defaultCalendarId || ''}
              onChange={(e) => setDefaultCalendarId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300"
            >
              <option value="">Use active calendar</option>
              {accounts.map((account) => (
                <optgroup key={account.id} label={account.name}>
                  {account.calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDefaultsSettings() {
  const { 
    defaultPriority,
    setDefaultPriority,
    defaultTags,
    setDefaultTags,
  } = useSettingsStore();
  const { data: tags = [] } = useTags();

  const priorities: { value: Priority; label: string; color: string }[] = [
    { value: 'none', label: 'None', color: 'surface' },
    { value: 'low', label: 'Low', color: 'blue' },
    { value: 'medium', label: 'Medium', color: 'amber' },
    { value: 'high', label: 'High', color: 'red' },
  ];

  const handleTagToggle = (tagId: string) => {
    if (defaultTags.includes(tagId)) {
      setDefaultTags(defaultTags.filter(id => id !== tagId));
    } else {
      setDefaultTags([...defaultTags, tagId]);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Task Defaults</h3>
      <p className="text-xs text-surface-500 dark:text-surface-400">
        These settings apply to newly created tasks.
      </p>
      <div className="space-y-6 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <div>
          <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Default Priority</h4>
          <div className="flex flex-wrap gap-2">
            {priorities.map((p) => (
              <button
                key={p.value}
                onClick={() => setDefaultPriority(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  defaultPriority === p.value
                    ? p.color === 'surface'
                      ? 'bg-surface-600 text-white'
                      : p.color === 'blue'
                        ? 'bg-blue-600 text-white'
                        : p.color === 'amber'
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-600 text-white'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Default Tags</h4>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">
              Selected tags will be automatically added to new tasks.
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    defaultTags.includes(tag.id)
                      ? 'ring-2 ring-offset-1 ring-primary-500 dark:ring-offset-surface-800'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {tags.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              No tags available. Create tags first to set defaults.
            </p>
          </div>
        )}
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
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Notifications</h3>
      <div className="space-y-3 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <div>
          <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Task Reminders</h4>
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

        <div className="p-3 bg-surface-200 dark:bg-surface-700 rounded-lg">
          <p className="text-sm text-surface-600 dark:text-surface-400">
            On macOS, you might need to allow notifications for this app when prompted.
          </p>
        </div>
      </div>
    </div>
  );
}

function DataSettings() {
  const { exportSettings, importSettings } = useSettingsStore();
  const [showIncluded, setShowIncluded] = useState(false);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Data</h3>
      <div className="space-y-6 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
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

        <div className="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
          <button
            onClick={() => setShowIncluded(!showIncluded)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            <span>What's included?</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showIncluded ? 'rotate-180' : ''}`} />
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

function ConnectionsSettings({ accounts }: { accounts: Account[] }) {
  const deleteAccountMutation = useDeleteAccount();
  const { confirm } = useConfirmDialog();
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const toggleExpanded = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleDeleteAccount = async (account: { id: string; name: string }) => {
    const confirmed = await confirm({
      title: 'Delete account',
      message: `Are you sure you want to delete "${account.name}"? All tasks from this account will be removed from the app (they will remain on the server).`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (confirmed) {
      deleteAccountMutation.mutate(account.id);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Connections</h3>
      <div className="space-y-3 rounded-lg bg-white dark:bg-surface-800">
        {accounts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">No accounts connected yet.</p>
            <p className="text-xs text-surface-400 dark:text-surface-500">Add an account from the sidebar to get started.</p>
          </div>
        ) : (
          accounts.map((account) => {
            const isExpanded = expandedAccounts.has(account.id);
            return (
              <div
                key={account.id}
                className="rounded-lg border border-surface-200 dark:border-surface-600 overflow-hidden"
              >
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                  onClick={() => toggleExpanded(account.id)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    <div>
                      <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{account.name}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{account.username} ({account.serverType})</p>
                    </div>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
                    Connected
                  </span>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-surface-200 dark:border-surface-600 p-3 bg-surface-50 dark:bg-surface-900/50 space-y-3">
                    <div>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Server</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300 font-mono break-all">{account.serverUrl}</p>
                    </div>
                    
                    {account.calendars.length > 0 && (
                      <div>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Calendars ({account.calendars.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {account.calendars.map(cal => (
                            <span key={cal.id} className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400 px-2 py-0.5 rounded">
                              {cal.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-surface-200 dark:border-surface-600">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAccount(account);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SyncSettings() {
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
        <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Sync</h3>
        
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
    </div>
  );
}

function ShortcutsSettings() {
  const { keyboardShortcuts, updateShortcut, resetShortcuts } = useSettingsStore();
  const [editingShortcut, setEditingShortcut] = useState<KeyboardShortcut | null>(null);

  const formatShortcut = (shortcut: KeyboardShortcut | Partial<KeyboardShortcut>): string => {
    const parts: string[] = [];
    if (shortcut.meta) parts.push(metaKeyLabel);
    if (shortcut.ctrl && !shortcut.meta) parts.push('Ctrl');
    if (shortcut.shift) parts.push(getShiftKeyLabel());
    if (shortcut.alt) parts.push(getAltKeyLabel());
    if (shortcut.key) {
      const keyDisplay = shortcut.key === ' ' ? 'Space' : 
                        shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
      parts.push(keyDisplay);
    }
    return parts.join(' + ') || 'Press keys...';
  };

  const handleSave = (id: string, updates: Partial<KeyboardShortcut>) => {
    updateShortcut(id, updates);
    setEditingShortcut(null);
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200">Keyboard Shortcuts</h3>
          <button
            onClick={resetShortcuts}
            className="flex items-center gap-1 px-2 py-1 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Defaults
          </button>
        </div>

        <p className="text-xs text-surface-500 dark:text-surface-400">
          Click the edit button to change a shortcut.
        </p>
        
        <div className="space-y-1 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
          {keyboardShortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between py-2 px-3 bg-white dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700 last:border-0"
            >
              <span className="text-sm text-surface-600 dark:text-surface-400">{shortcut.description}</span>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {formatShortcut(shortcut).split(' + ').map((key, keyIndex, arr) => (
                    <span key={keyIndex} className="flex items-center">
                      <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded text-xs font-mono text-surface-700 dark:text-surface-300">
                        {key}
                      </kbd>
                      {keyIndex < arr.length - 1 && (
                        <span className="text-surface-400 mx-0.5">+</span>
                      )}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setEditingShortcut(shortcut)}
                  className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
                  title="Edit shortcut"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <KeyboardShortcutModal
        isOpen={editingShortcut !== null}
        shortcut={editingShortcut}
        onClose={() => setEditingShortcut(null)}
        onSave={handleSave}
      />
    </>
  );
}

function AboutSettings() {
  const appInfo = packageJson as { version?: string; name?: string; description?: string; author: string; };
  const appVersion = appInfo.version || 'dev';
  const appName = appInfo.name || 'caldav app test';
  const appDescription = appInfo.description || 'A CalDAV-compatible task management client.';
  const appAuthor = appInfo.author;

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-surface-800 dark:text-surface-200 mb-1">{appName}</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">Version {appVersion}</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-2">About</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            {appDescription}
          </p>
        </div>

        <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-2">Credits</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            {appAuthor}
          </p>
        </div>
      </div>
    </div>
  );
}
