import { useCallback, useEffect, useMemo } from 'react';
import { useModalState } from '@/context/modalStateContext';
import {
  useCreateTask,
  useFilteredTasks,
  useSetEditorOpen,
  useSetSearchQuery,
  useSetSelectedTask,
  useSetShowCompletedTasks,
  useToggleTaskComplete,
  useUIState,
} from '@/hooks/queries';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useConfirmTaskDelete } from '@/hooks/useConfirmTaskDelete';
import { getIsKeyboardDragging } from '@/lib/dragState';
import * as taskData from '@/lib/taskData';
import { type KeyboardShortcut, useSettingsStore } from '@/store/settingsStore';
import { flattenTasks } from '@/utils/tree';
import {
  getAltKeyLabel,
  getMetaKeyLabel,
  getModifierJoiner,
  getShiftKeyLabel,
} from '../utils/keyboard';

interface UseKeyboardShortcutsOptions {
  onOpenSettings?: () => void;
  onSync?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onOpenSettings, onSync } = options;
  const { data: uiState } = useUIState();
  const { data: filteredTasks = [] } = useFilteredTasks();
  const createTaskMutation = useCreateTask();
  const setSearchQueryMutation = useSetSearchQuery();
  const toggleTaskCompleteMutation = useToggleTaskComplete();
  const setSelectedTaskMutation = useSetSelectedTask();
  const setEditorOpenMutation = useSetEditorOpen();
  const setShowCompletedMutation = useSetShowCompletedTasks();

  const selectedTaskId = uiState?.selectedTaskId ?? null;
  const showCompletedTasks = uiState?.showCompletedTasks ?? true;
  const sortConfig = uiState?.sortConfig ?? { mode: 'manual' as const, direction: 'asc' as const };

  const { keyboardShortcuts } = useSettingsStore();
  const { confirmAndDelete } = useConfirmTaskDelete();
  const { isOpen: isConfirmDialogOpen } = useConfirmDialog();
  const { isAnyModalOpen } = useModalState();

  // build the flattened task list that matches visual rendering order of tasks when using keyboard navigation
  const flattenedTasks = useMemo(() => {
    const topLevelTasks = filteredTasks.filter((task) => !task.parentUid);
    const sortedTopLevel = taskData.getSortedTasks(topLevelTasks, sortConfig);

    const getFilteredChildTasks = (parentUid: string) => {
      const children = taskData.getChildTasks(parentUid);
      if (!showCompletedTasks) {
        return children.filter((task) => !task.completed);
      }
      return children;
    };

    return flattenTasks(sortedTopLevel, getFilteredChildTasks, (tasks) =>
      taskData.getSortedTasks(tasks, sortConfig),
    );
  }, [filteredTasks, sortConfig, showCompletedTasks]);

  const handleNewTask = useCallback(() => {
    createTaskMutation.mutate(
      { title: '' },
      {
        onSuccess: (task) => {
          setSelectedTaskMutation.mutate(task.id);
        },
      },
    );
  }, [createTaskMutation, setSelectedTaskMutation]);

  const handleSearch = useCallback(() => {
    const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
    if (searchInput) {
      // Toggle focus: if already focused, blur it; otherwise focus it
      if (document.activeElement === searchInput) {
        searchInput.blur();
      } else {
        searchInput.focus();
      }
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (selectedTaskId) {
      await confirmAndDelete(selectedTaskId);
    }
  }, [selectedTaskId, confirmAndDelete]);

  const handleToggleComplete = useCallback(() => {
    if (selectedTaskId) {
      toggleTaskCompleteMutation.mutate(selectedTaskId);
    }
  }, [selectedTaskId, toggleTaskCompleteMutation]);

  const handleEscape = useCallback(() => {
    setSearchQueryMutation.mutate('');
    setEditorOpenMutation.mutate(false);
    const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
    searchInput?.blur();
  }, [setSearchQueryMutation, setEditorOpenMutation]);

  const handleNavigateUp = useCallback(() => {
    if (flattenedTasks.length === 0) return;

    if (!selectedTaskId) {
      setSelectedTaskMutation.mutate(flattenedTasks[0].id);
      return;
    }

    const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
    if (currentIndex > 0) {
      setSelectedTaskMutation.mutate(flattenedTasks[currentIndex - 1].id);
    }
  }, [selectedTaskId, flattenedTasks, setSelectedTaskMutation]);

  const handleNavigateDown = useCallback(() => {
    if (flattenedTasks.length === 0) return;

    if (!selectedTaskId) {
      setSelectedTaskMutation.mutate(flattenedTasks[0].id);
      return;
    }

    const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
    if (currentIndex < flattenedTasks.length - 1) {
      setSelectedTaskMutation.mutate(flattenedTasks[currentIndex + 1].id);
    }
  }, [selectedTaskId, flattenedTasks, setSelectedTaskMutation]);

  const handleOpenSettings = useCallback(() => {
    // If settings is already open, this will close it (toggle behavior)
    onOpenSettings?.();
  }, [onOpenSettings]);

  const handleSync = useCallback(() => {
    onSync?.();
  }, [onSync]);

  const handleToggleShowCompleted = useCallback(() => {
    setShowCompletedMutation.mutate(!showCompletedTasks);
  }, [setShowCompletedMutation, showCompletedTasks]);

  // Map shortcut IDs to their handler functions
  const actionHandlers: Record<string, () => void> = useMemo(
    () => ({
      'new-task': handleNewTask,
      search: handleSearch,
      settings: handleOpenSettings,
      sync: handleSync,
      delete: handleDelete,
      'toggle-complete': handleToggleComplete,
      'toggle-show-completed': handleToggleShowCompleted,
      close: handleEscape,
      'nav-up': handleNavigateUp,
      'nav-down': handleNavigateDown,
    }),
    [
      handleNewTask,
      handleSearch,
      handleOpenSettings,
      handleSync,
      handleDelete,
      handleToggleComplete,
      handleToggleShowCompleted,
      handleEscape,
      handleNavigateUp,
      handleNavigateDown,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // if confirm dialog is open, let it consume keys (Esc/Enter) without triggering app shortcuts
      if (isConfirmDialogOpen) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
        }
        return;
      }

      // if keyboard dragging is in progress (via dnd-kit KeyboardSensor),
      // let dnd-kit handle all keyboard events (arrow keys, enter, escape)
      if (getIsKeyboardDragging()) {
        return;
      }

      // don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // allow some shortcuts even in inputs
      // Escape: close editor/clear search
      const allowInInput = ['Escape'];

      const isAllowedInInput = allowInInput.includes(e.key);

      if (isInput && !isAllowedInInput) {
        return;
      }

      // Shortcuts that should NOT work when a modal is open
      // (except for 'settings' which toggles, and 'close' which closes modals)
      const blockedInModal = [
        'new-task',
        'search',
        'sync',
        'delete',
        'toggle-complete',
        'toggle-show-completed',
        'nav-up',
        'nav-down',
      ];

      for (const shortcut of keyboardShortcuts) {
        const handler = actionHandlers[shortcut.id];
        if (!handler) continue;

        // Block certain shortcuts when a modal is open
        if (isAnyModalOpen && blockedInModal.includes(shortcut.id)) {
          continue;
        }

        const metaMatch = shortcut.meta ? e.metaKey || e.ctrlKey : true;
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          metaMatch &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          // only match if modifier requirements are exactly met
          if (
            (shortcut.meta && (e.metaKey || e.ctrlKey)) ||
            (shortcut.ctrl && e.ctrlKey) ||
            (!shortcut.meta && !shortcut.ctrl)
          ) {
            e.preventDefault();
            handler();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcuts, actionHandlers, isConfirmDialogOpen, isAnyModalOpen]);

  return { shortcuts: keyboardShortcuts };
}

export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.meta) {
    parts.push(getMetaKeyLabel());
  }
  if (shortcut.ctrl && !shortcut.meta) {
    parts.push('Ctrl');
  }
  if (shortcut.shift) {
    parts.push(getShiftKeyLabel());
  }
  if (shortcut.alt) {
    parts.push(getAltKeyLabel());
  }

  const keyDisplay = shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase();
  parts.push(keyDisplay);

  return parts.join(getModifierJoiner());
}
