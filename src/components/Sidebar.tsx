import { useState, useCallback } from 'react';
import ChevronDown from 'lucide-react/icons/chevron-down';
import ChevronRight from 'lucide-react/icons/chevron-right';
import Plus from 'lucide-react/icons/plus';
import Settings from 'lucide-react/icons/settings';
import FolderKanban from 'lucide-react/icons/folder-kanban';
import User from 'lucide-react/icons/user';
import Trash2 from 'lucide-react/icons/trash-2';
import Edit2 from 'lucide-react/icons/edit-2';
import RefreshCw from 'lucide-react/icons/refresh-cw';
import Inbox from 'lucide-react/icons/inbox';
import MoreVertical from 'lucide-react/icons/more-vertical';
import Share2 from 'lucide-react/icons/share-2';
import Upload from 'lucide-react/icons/upload';
import { 
  useAccounts,
  useTags,
  useUIState,
  useTasks,
  useSetActiveAccount,
  useSetActiveCalendar,
  useSetActiveTag,
  useSetAllTasksView,
  useDeleteAccount,
  useDeleteTag,
} from '@/hooks/queries';
import * as taskData from '@/lib/taskData';
import { useGlobalContextMenuClose } from '@/hooks/useGlobalContextMenu';
import { useModalState } from '@/context/modalStateContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useSettingsStore } from '@/store/settingsStore';
import { Account, Calendar as CalendarType } from '@/types';
import { AccountModal } from './modals/AccountModal';
import { TagModal } from './modals/TagModal';
import { CalendarModal } from './modals/CalendarModal';
import { CreateCalendarModal } from './modals/CreateCalendarModal';
import { ExportModal } from './modals/ExportModal';
import { caldavService } from '@/lib/caldav';
import { getContrastTextColor } from '../utils/color';
import { getIconByName } from './IconPicker';
import { Tooltip } from './Tooltip';
import { clampToViewport } from '../utils/position';
import { getMetaKeyLabel, getModifierJoiner } from '../utils/keyboard';

interface SidebarProps {
  onOpenSettings?: () => void;
  onOpenImport?: () => void;
}

export function Sidebar({ onOpenSettings, onOpenImport }: SidebarProps) {
  const { data: accounts = [] } = useAccounts();
  const { data: tags = [] } = useTags();
  const { data: uiState } = useUIState();
  const { data: tasks = [] } = useTasks();
  
  const setActiveAccountMutation = useSetActiveAccount();
  const setActiveCalendarMutation = useSetActiveCalendar();
  const setActiveTagMutation = useSetActiveTag();
  const setAllTasksViewMutation = useSetAllTasksView();
  const deleteAccountMutation = useDeleteAccount();
  const deleteTagMutation = useDeleteTag();

  const activeCalendarId = uiState?.activeCalendarId ?? null;
  const activeTagId = uiState?.activeTagId ?? null;

  const { isAnyModalOpen } = useModalState();
  const { confirm } = useConfirmDialog();
  const { 
    confirmBeforeDeleteCalendar, 
    confirmBeforeDeleteAccount, 
    confirmBeforeDeleteTag 
  } = useSettingsStore();

  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set(accounts.map((a) => a.id))
  );
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCalendarId, setExportCalendarId] = useState<string | null>(null);
  const [exportAccountId, setExportAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingCalendar, setEditingCalendar] = useState<{ calendar: CalendarType; accountId: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    type: 'account' | 'calendar' | 'tag';
    id: string;
    accountId?: string;
    x: number;
    y: number;
  } | null>(null);
  const metaKey = getMetaKeyLabel();
  const modifierJoiner = getModifierJoiner();
  const settingsShortcut = `${metaKey}${modifierJoiner},`;

  const toggleAccount = (id: string) => {
    const next = new Set(expandedAccounts);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedAccounts(next);
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'account' | 'calendar' | 'tag',
    id: string,
    accountId?: string
  ) => {
    e.preventDefault();
      // dispatch event to close other context menus first
    document.dispatchEvent(new CustomEvent('closeAllContextMenus'));
    const { x, y } = clampToViewport(e.clientX, e.clientY);
    setContextMenu({ type, id, accountId, x, y });
  };

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // register for global context menu close
  useGlobalContextMenuClose(handleCloseContextMenu, contextMenu !== null);

  const getTaskCount = (calendarId: string) => {
    return tasks.filter((t) => t.calendarId === calendarId && !t.completed).length;
  };

  const getTotalActiveTaskCount = () => {
    return tasks.filter((t) => !t.completed).length;
  };

  const getTagTaskCount = (tagId: string) => {
    return tasks.filter((t) => (t.tags || []).includes(tagId) && !t.completed).length;
  };

  return (
    <>
      <div 
        className="w-64 bg-surface-100 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 flex flex-col h-full"
        onClick={handleCloseContextMenu}
      >
        <div className="h-[53px] px-4 flex items-center border-b border-surface-200 dark:border-surface-700">
          <h1 className="text-lg font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            caldav-tasks
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <button
            onClick={() => {
              setAllTasksViewMutation.mutate();
              setActiveAccountMutation.mutate(null);
            }}
            className={`w-full flex items-center gap-2 px-4 py-2 mb-2 text-sm transition-colors ${
              activeCalendarId === null && activeTagId === null
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : `text-surface-600 dark:text-surface-400 ${!isAnyModalOpen ? 'hover:bg-surface-200 dark:hover:bg-surface-700' : ''}`
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span className="flex-1 text-left">All Tasks</span>
            <span className="text-xs text-surface-400">
              {getTotalActiveTaskCount()}
            </span>
          </button>

          <div className="mb-4">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                Accounts
              </span>
              <div className="flex items-center gap-1">
                <Tooltip content="Import tasks" position="top">
                  <button
                    onClick={onOpenImport}
                    className={`p-1 rounded ${!isAnyModalOpen ? 'hover:bg-surface-300 dark:hover:bg-surface-600 hover:text-surface-700 dark:hover:text-surface-300' : ''} text-surface-500 dark:text-surface-400 transition-colors`}
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip content="Add account" position="top">
                  <button
                    onClick={() => {
                      setEditingAccount(null);
                      setShowAccountModal(true);
                    }}
                    className={`p-1 rounded ${!isAnyModalOpen ? 'hover:bg-surface-300 dark:hover:bg-surface-600 hover:text-surface-700 dark:hover:text-surface-300' : ''} text-surface-500 dark:text-surface-400 transition-colors`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {accounts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-surface-500 dark:text-surface-400">
                No accounts yet. Add one to get started.
              </div>
            ) : (
              accounts.map((account) => (
                <div key={account.id} data-context-menu>
                  <div 
                    onClick={() => toggleAccount(account.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'account', account.id)}
                    className={`relative w-full flex items-center gap-2 px-4 py-1.5 text-sm ${!isAnyModalOpen ? 'hover:bg-surface-200 dark:hover:bg-surface-700' : ''} transition-colors group cursor-pointer`}
                  >
                    {expandedAccounts.has(account.id) ? (
                      <ChevronDown className="w-4 h-4 text-surface-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-surface-400 flex-shrink-0" />
                    )}
                    <User className="w-4 h-4 text-surface-500 dark:text-surface-400 flex-shrink-0" />
                    <span className="flex-1 text-left truncate text-surface-700 dark:text-surface-300">
                      {account.name}
                    </span>
                    <Tooltip content="Add a new calendar" position="top">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreateCalendarModal(account.id);
                        }}
                        onContextMenu={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, 'account', account.id);
                        }}
                        className={`p-1.5 rounded bg-transparent ${!isAnyModalOpen ? 'hover:bg-surface-300 dark:hover:bg-surface-600 hover:text-surface-600 dark:hover:text-surface-300' : ''} text-surface-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Account menu" position="top">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e as any, 'account', account.id);
                        }}
                        onContextMenu={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, 'account', account.id);
                        }}
                        className="p-1.5 rounded bg-transparent hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>

                  {expandedAccounts.has(account.id) && (
                    <div>
                      {account.calendars.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-surface-500 dark:text-surface-400">
                          No calendars yet.
                        </div>
                      ) : (
                        account.calendars.map((calendar) => {
                          const CalendarIcon = getIconByName(calendar.icon || 'calendar');
                          const isActive = activeCalendarId === calendar.id;
                          const calendarColor = calendar.color ?? '#3b82f6';
                          const textColor = isActive ? getContrastTextColor(calendarColor) : undefined;
                          return (
                            <button
                              key={calendar.id}
                              data-context-menu
                              onClick={() => {
                                setActiveAccountMutation.mutate(account.id);
                                setActiveCalendarMutation.mutate(calendar.id);
                              }}
                              onContextMenu={(e) => handleContextMenu(e, 'calendar', calendar.id, account.id)}
                              className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                                isActive
                                  ? ''
                                  : `text-surface-600 dark:text-surface-400 ${!isAnyModalOpen ? 'hover:bg-surface-200 dark:hover:bg-surface-700' : ''}`
                              }`}
                              style={isActive ? { backgroundColor: calendarColor, color: textColor } : undefined}
                            >
                              <CalendarIcon 
                                className="w-4 h-4" 
                                style={{ color: isActive ? textColor : calendarColor }}
                              />
                              <span className="flex-1 text-left truncate">
                                {calendar.displayName}
                              </span>
                              <span className="text-xs">
                                {getTaskCount(calendar.id)}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                Tags
              </span>
              <Tooltip content="Add a new tag" position="top">
                <button
                  onClick={() => {
                    setEditingTagId(null);
                    setShowTagModal(true);
                  }}
                  className={`p-1 rounded ${!isAnyModalOpen ? 'hover:bg-surface-300 dark:hover:bg-surface-600 hover:text-surface-700 dark:hover:text-surface-300' : ''} text-surface-500 dark:text-surface-400 transition-colors`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>

            {tags.length === 0 ? (
              <div className="px-4 py-3 text-sm text-surface-500 dark:text-surface-400">
                No tags yet.
              </div>
            ) : (
              tags.map((tag) => {
                const TagIcon = getIconByName(tag.icon || 'tag');
                const isActive = activeTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    data-context-menu
                    onClick={() => setActiveTagMutation.mutate(tag.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'tag', tag.id)}
                    className={`w-full flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : `text-surface-600 dark:text-surface-400 ${!isAnyModalOpen ? 'hover:bg-surface-200 dark:hover:bg-surface-700' : ''}`
                    }`}
                  >
                    <TagIcon
                      className="w-3.5 h-3.5"
                      style={{ color: tag.color }}
                    />
                    <span className="flex-1 text-left truncate">{tag.name}</span>
                    <span className="text-xs text-surface-400">
                      {getTagTaskCount(tag.id)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-surface-200 dark:border-surface-700 p-2">
          <button 
            onClick={() => onOpenSettings?.()}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-600 dark:text-surface-400 ${!isAnyModalOpen ? 'hover:bg-surface-200 dark:hover:bg-surface-700' : ''} rounded-md transition-colors`}
          >
            <Settings className="w-4 h-4" />
            Settings
            <span className="ml-auto text-xs text-surface-400">{settingsShortcut}</span>
          </button>
        </div>
      </div>

      {contextMenu && (
        <div
          data-context-menu-content
          className="fixed bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-50 min-w-[160px] animate-scale-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'account' && (
            <button
              onClick={() => {
                setShowCreateCalendarModal(contextMenu.id);
                handleCloseContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              <Plus className="w-4 h-4" />
              New Calendar
            </button>
          )}
          
          {contextMenu.type === 'account' && (
            <button
              onClick={() => {
                setExportAccountId(contextMenu.id);
                setShowExportModal(true);
                handleCloseContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              <Share2 className="w-4 h-4" />
              Export All Calendars
            </button>
          )}
          
          {contextMenu.type === 'calendar' && (
            <button
              onClick={() => {
                // trigger sync for this calendar
                if (contextMenu.accountId) {
                  setActiveAccountMutation.mutate(contextMenu.accountId);
                }
                setActiveCalendarMutation.mutate(contextMenu.id);
                handleCloseContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              <RefreshCw className="w-4 h-4" />
              Sync
            </button>
          )}
          
          {contextMenu.type === 'calendar' && (
            <button
              onClick={() => {
                setExportCalendarId(contextMenu.id);
                setShowExportModal(true);
                handleCloseContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              <Share2 className="w-4 h-4" />
              Export
            </button>
          )}
          
          <button
            onClick={async () => {
              if (contextMenu.type === 'account') {
                const account = accounts.find((a) => a.id === contextMenu.id);
                if (account) {
                  setEditingAccount(account);
                  setShowAccountModal(true);
                }
              } else if (contextMenu.type === 'tag') {
                setEditingTagId(contextMenu.id);
                setShowTagModal(true);
              } else if (contextMenu.type === 'calendar' && contextMenu.accountId) {
                const account = accounts.find((a) => a.id === contextMenu.accountId);
                const calendar = account?.calendars.find((c) => c.id === contextMenu.id);
                if (calendar && contextMenu.accountId) {
                  setEditingCalendar({ calendar, accountId: contextMenu.accountId });
                  setShowCalendarModal(true);
                }
              }
              handleCloseContextMenu();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          
          <div className="border-t border-surface-200 dark:border-surface-700 my-1" />
          <button
            onClick={async () => {
              // Close context menu immediately before showing confirmation
              handleCloseContextMenu();
              
              if (contextMenu.type === 'account') {
                const account = accounts.find(a => a.id === contextMenu.id);
                if (confirmBeforeDeleteAccount) {
                  const confirmed = await confirm({
                    title: 'Remove account',
                    subtitle: account?.name,
                    message: 'Are you sure? All tasks from this account will be removed from the app. They will remain on the server.',
                    confirmLabel: 'Remove',
                    destructive: true,
                  });
                  if (!confirmed) {
                    return;
                  }
                }
                deleteAccountMutation.mutate(contextMenu.id);
              } else if (contextMenu.type === 'tag') {
                const tag = tags.find(t => t.id === contextMenu.id);
                if (confirmBeforeDeleteTag) {
                  const confirmed = await confirm({
                    title: 'Delete tag',
                    subtitle: tag?.name,
                    message: 'Are you sure? Tasks with this tag will not be affected.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (!confirmed) {
                    return;
                  }
                }
                deleteTagMutation.mutate(contextMenu.id);
              } else if (contextMenu.type === 'calendar' && contextMenu.accountId) {
                const account = accounts.find((a) => a.id === contextMenu.accountId);
                const calendar = account?.calendars.find((c) => c.id === contextMenu.id);
                if (confirmBeforeDeleteCalendar) {
                  const confirmed = await confirm({
                    title: 'Delete calendar',
                    subtitle: calendar?.displayName,
                    message: 'Are you sure? This calendar and all its tasks will be deleted from the server.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (!confirmed) {
                    return;
                  }
                }
                // delete calendar from server
                try {
                  await caldavService.deleteCalendar(contextMenu.accountId, contextMenu.id);
                  // delete calendar and its tasks from local state
                  taskData.deleteCalendar(contextMenu.accountId, contextMenu.id);
                } catch (error) {
                  console.error('Failed to delete calendar:', error);
                }
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {showAccountModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setShowAccountModal(false);
            setEditingAccount(null);
          }}
        />
      )}

      {showTagModal && (
        <TagModal
          tagId={editingTagId}
          onClose={() => {
            setShowTagModal(false);
            setEditingTagId(null);
          }}
        />
      )}

      {showCalendarModal && editingCalendar && (
        <CalendarModal
          calendar={editingCalendar.calendar}
          accountId={editingCalendar.accountId}
          onClose={() => {
            setShowCalendarModal(false);
            setEditingCalendar(null);
          }}
        />
      )}

      {showCreateCalendarModal && (
        <CreateCalendarModal
          accountId={showCreateCalendarModal}
          onClose={() => setShowCreateCalendarModal(null)}
        />
      )}

      {showExportModal && exportCalendarId && (
        <ExportModal
          tasks={taskData.getCalendarTasks(exportCalendarId)}
          type="single-calendar"
          calendarName={
            accounts
              .flatMap((a) => a.calendars)
              .find((c) => c.id === exportCalendarId)?.displayName
          }
          fileName={
            accounts
              .flatMap((a) => a.calendars)
              .find((c) => c.id === exportCalendarId)?.displayName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'export'
          }
          onClose={() => {
            setShowExportModal(false);
            setExportCalendarId(null);
          }}
        />
      )}

      {showExportModal && exportAccountId && (
        <ExportModal
          tasks={tasks.filter((t) => t.accountId === exportAccountId)}
          calendars={accounts.find((a) => a.id === exportAccountId)?.calendars || []}
          type="all-calendars"
          fileName={
            accounts.find((a) => a.id === exportAccountId)?.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'account-export'
          }
          onClose={() => {
            setShowExportModal(false);
            setExportAccountId(null);
          }}
        />
      )}
    </>
  );
}
