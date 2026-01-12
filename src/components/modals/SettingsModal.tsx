import Bell from 'lucide-react/icons/bell';
import Database from 'lucide-react/icons/database';
import Info from 'lucide-react/icons/info';
import Keyboard from 'lucide-react/icons/keyboard';
import ListTodo from 'lucide-react/icons/list-todo';
import Palette from 'lucide-react/icons/palette';
import RefreshCw from 'lucide-react/icons/refresh-cw';
import Settings from 'lucide-react/icons/settings';
import User from 'lucide-react/icons/user';
import X from 'lucide-react/icons/x';
import { useState } from 'react';
import { useAccounts } from '@/hooks/queries';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import {
  AboutSettings,
  AppearanceSettings,
  BehaviorSettings,
  ConnectionsSettings,
  DataSettings,
  NotificationSettings,
  ShortcutsSettings,
  SyncSettings,
  TaskDefaultsSettings,
} from './settings';

interface SettingsModalProps {
  onClose: () => void;
  initialCategory?: SettingsCategory;
  initialSubtab?: SettingsSubtab;
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

export function SettingsModal({ onClose, initialCategory, initialSubtab }: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(
    initialCategory || 'general',
  );
  const [activeSubtabs, setActiveSubtabs] = useState<Record<SettingsCategory, SettingsSubtab>>({
    general: initialCategory === 'general' && initialSubtab ? initialSubtab : 'behavior',
    account: initialCategory === 'account' && initialSubtab ? initialSubtab : 'connections',
    about: initialCategory === 'about' && initialSubtab ? initialSubtab : 'version',
  });
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const { data: accounts = [] } = useAccounts();

  // handle ESC key to close modal - but not if a child modal is open
  useModalEscapeKey(() => {
    if (!isChildModalOpen) {
      onClose();
    }
  });

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
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-3xl h-[80vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-56 border-r border-surface-200 dark:border-surface-700 p-3 space-y-4 bg-white dark:bg-surface-800 rounded-l-xl overflow-y-auto overscroll-contain">
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
                        type="button"
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
                {currentSubtab === 'shortcuts' && (
                  <ShortcutsSettings onEditingShortcutChange={setIsChildModalOpen} />
                )}
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
