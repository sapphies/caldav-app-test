import { formatDistanceToNow } from 'date-fns';
import SortDesc from 'lucide-react/icons/arrow-down-wide-narrow';
import SortAsc from 'lucide-react/icons/arrow-up-narrow-wide';
import Eye from 'lucide-react/icons/eye';
import EyeOff from 'lucide-react/icons/eye-off';
import Plus from 'lucide-react/icons/plus';
import RefreshCw from 'lucide-react/icons/refresh-cw';
import Search from 'lucide-react/icons/search';
import WifiOff from 'lucide-react/icons/wifi-off';
import { useEffect, useState } from 'react';
import { useModalState } from '@/context/modalStateContext';
import {
  useCreateTask,
  useSetSearchQuery,
  useSetSelectedTask,
  useSetShowCompletedTasks,
  useSetSortConfig,
  useUIState,
} from '@/hooks/queries';
import type { SortMode } from '@/types';
import { getMetaKeyLabel, getModifierJoiner } from '../utils/keyboard';
import { Tooltip } from './Tooltip';

const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'smart', label: 'Smart Sort' },
  { value: 'due-date', label: 'Due Date' },
  { value: 'start-date', label: 'Start Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
  { value: 'modified', label: 'Last Modified' },
  { value: 'created', label: 'Created' },
];

interface HeaderProps {
  isSyncing?: boolean;
  isOffline?: boolean;
  lastSyncTime?: Date | null;
  onSync?: () => void;
  disableSync?: boolean;
}

export function Header({
  isSyncing = false,
  isOffline = false,
  lastSyncTime,
  onSync,
  disableSync = false,
}: HeaderProps) {
  const { data: uiState } = useUIState();
  const setSearchQueryMutation = useSetSearchQuery();
  const setSortConfigMutation = useSetSortConfig();
  const setShowCompletedTasksMutation = useSetShowCompletedTasks();
  const createTaskMutation = useCreateTask();
  const setSelectedTaskMutation = useSetSelectedTask();

  const searchQuery = uiState?.searchQuery ?? '';
  const sortConfig = uiState?.sortConfig ?? {
    mode: 'manual' as SortMode,
    direction: 'asc' as const,
  };
  const showCompletedTasks = uiState?.showCompletedTasks ?? true;

  const { isAnyModalOpen } = useModalState();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const metaKey = getMetaKeyLabel();
  const modifierJoiner = getModifierJoiner();
  const searchShortcut = `${metaKey}${modifierJoiner}F`;
  const syncShortcut = `${metaKey}${modifierJoiner}R`;

  // handle ESC key to close sort dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSortMenu) {
        setShowSortMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSortMenu]);

  const handleNewTask = () => {
    createTaskMutation.mutate(
      { title: '' },
      {
        onSuccess: (task) => {
          setSelectedTaskMutation.mutate(task.id);
        },
      },
    );
  };

  const toggleSortDirection = () => {
    setSortConfigMutation.mutate({
      ...sortConfig,
      direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleSortChange = (mode: SortMode) => {
    setSortConfigMutation.mutate({ ...sortConfig, mode });
    setShowSortMenu(false);
  };

  return (
    <header className="h-[53px] bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 px-4 flex items-center">
      <div className="flex-1 flex items-center justify-between gap-4">
        <div className="flex-1 relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            data-search-input
            placeholder={`Search tasks... (${searchShortcut})`}
            value={searchQuery}
            onChange={(e) => setSearchQueryMutation.mutate(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-100 dark:bg-surface-700 border border-transparent rounded-lg text-sm text-surface-800 dark:text-surface-200 placeholder:text-surface-400 focus:outline-none focus:border-primary-300 focus:bg-white dark:focus:bg-surface-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isOffline && (
            <div className="flex items-center gap-1 px-2 py-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-sm">
              <WifiOff className="w-4 h-4" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {onSync && (
            <Tooltip
              content={
                disableSync
                  ? 'Add an account to be able to use sync'
                  : isOffline
                    ? 'Cannot sync while offline'
                    : lastSyncTime
                      ? `Last synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`
                      : `Sync with server (${syncShortcut})`
              }
              position="bottom"
            >
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing || isOffline || disableSync}
                className={`p-2 rounded-lg transition-colors ${
                  isSyncing
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                    : isOffline || disableSync
                      ? 'text-surface-300 dark:text-surface-600 cursor-not-allowed'
                      : `text-surface-500 dark:text-surface-400 ${!isAnyModalOpen ? 'hover:bg-surface-100 dark:hover:bg-surface-700' : ''}`
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
          )}

          <Tooltip
            content={showCompletedTasks ? 'Hide completed tasks' : 'Show completed tasks'}
            position="bottom"
          >
            <button
              type="button"
              onClick={() => setShowCompletedTasksMutation.mutate(!showCompletedTasks)}
              className={`p-2 rounded-lg transition-colors ${
                showCompletedTasks
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : `text-surface-500 dark:text-surface-400 ${!isAnyModalOpen ? 'hover:bg-surface-100 dark:hover:bg-surface-700' : ''}`
              }`}
            >
              {showCompletedTasks ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
          </Tooltip>

          <div className="relative">
            <Tooltip content="Change sort order" position="bottom">
              <button
                type="button"
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                  showSortMenu
                    ? 'bg-surface-200 dark:bg-surface-600 text-surface-700 dark:text-surface-200'
                    : `text-surface-600 dark:text-surface-400 ${!isAnyModalOpen ? 'hover:bg-surface-100 dark:hover:bg-surface-700' : ''}`
                }`}
              >
                {sortConfig.direction === 'asc' ? (
                  <SortAsc className="w-4 h-4" />
                ) : (
                  <SortDesc className="w-4 h-4" />
                )}
                <span>{sortOptions.find((o) => o.value === sortConfig.mode)?.label}</span>
              </button>
            </Tooltip>

            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div
                  data-context-menu-content
                  className="absolute right-0 top-full mt-1 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-50 min-w-[180px] animate-scale-in"
                >
                  {sortOptions.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-100 dark:hover:bg-surface-700 ${
                        sortConfig.mode === option.value
                          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                          : 'text-surface-700 dark:text-surface-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <div className="border-t border-surface-200 dark:border-surface-700 my-1" />
                  <button
                    type="button"
                    onClick={toggleSortDirection}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                  >
                    {sortConfig.direction === 'asc' ? (
                      <>
                        <SortAsc className="w-4 h-4" />
                        Ascending
                      </>
                    ) : (
                      <>
                        <SortDesc className="w-4 h-4" />
                        Descending
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleNewTask}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border text-sm transition-colors border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ${!isAnyModalOpen ? 'hover:bg-primary-100 dark:hover:bg-primary-800' : ''} shadow-sm`}
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>
    </header>
  );
}
