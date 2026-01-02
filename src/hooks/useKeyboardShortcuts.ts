import { useEffect, useCallback } from 'react';
import { useTaskStore } from '@/store/taskStore';
import { getAltKeyLabel, getMetaKeyLabel, getModifierJoiner, getShiftKeyLabel } from '../utils/keyboard';
import { useConfirmTaskDelete } from '@/hooks/useConfirmTaskDelete';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { KeyboardShortcut } from '@/store/settingsStore';
import { getIsKeyboardDragging } from '@/lib/dragState';

interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  onOpenSettings?: () => void;
  onSync?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onOpenSettings, onSync } = options;
  const {
    addTask,
    setSearchQuery,
    selectedTaskId,
    toggleTaskComplete,
    setSelectedTask,
    setEditorOpen,
    getFilteredTasks,
    getSortedTasks,
  } = useTaskStore();
  const { confirmAndDelete } = useConfirmTaskDelete();
  const { isOpen: isConfirmDialogOpen } = useConfirmDialog();
  
  const handleNewTask = useCallback(() => {
    const task = addTask({ title: '' });
    setSelectedTask(task.id);
  }, [addTask, setSelectedTask]);

  const handleSearch = useCallback(() => {
    const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
    searchInput?.focus();
  }, []);

  const handleDelete = useCallback(async () => {
    if (selectedTaskId) {
      await confirmAndDelete(selectedTaskId);
    }
  }, [selectedTaskId, confirmAndDelete]);

  const handleToggleComplete = useCallback(() => {
    if (selectedTaskId) {
      toggleTaskComplete(selectedTaskId);
    }
  }, [selectedTaskId, toggleTaskComplete]);

  const handleEscape = useCallback(() => {
    setSearchQuery('');
    setEditorOpen(false);
    const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
    searchInput?.blur();
  }, [setSearchQuery, setEditorOpen]);

  const handleNavigateUp = useCallback(() => {
    const filteredTasks = getFilteredTasks();
    const sortedTasks = getSortedTasks(filteredTasks);
    
    if (sortedTasks.length === 0) return;
    
    if (!selectedTaskId) {
      setSelectedTask(sortedTasks[0].id);
      return;
    }
    
    const currentIndex = sortedTasks.findIndex((t) => t.id === selectedTaskId);
    if (currentIndex > 0) {
      setSelectedTask(sortedTasks[currentIndex - 1].id);
    }
  }, [selectedTaskId, getFilteredTasks, getSortedTasks, setSelectedTask]);

  const handleNavigateDown = useCallback(() => {
    const filteredTasks = getFilteredTasks();
    const sortedTasks = getSortedTasks(filteredTasks);
    
    if (sortedTasks.length === 0) return;
    
    if (!selectedTaskId) {
      setSelectedTask(sortedTasks[0].id);
      return;
    }
    
    const currentIndex = sortedTasks.findIndex((t) => t.id === selectedTaskId);
    if (currentIndex < sortedTasks.length - 1) {
      setSelectedTask(sortedTasks[currentIndex + 1].id);
    }
  }, [selectedTaskId, getFilteredTasks, getSortedTasks, setSelectedTask]);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
  }, [onOpenSettings]);

  const handleSync = useCallback(() => {
    onSync?.();
  }, [onSync]);

  const shortcuts: ShortcutAction[] = [
    {
      key: 'n',
      meta: true,
      action: handleNewTask,
      description: 'Create new task',
    },
    {
      key: 'n',
      ctrl: true,
      action: handleNewTask,
      description: 'Create new task',
    },
    {
      key: 'f',
      meta: true,
      action: handleSearch,
      description: 'Focus search',
    },
    {
      key: 'f',
      ctrl: true,
      action: handleSearch,
      description: 'Focus search',
    },
    {
      key: ',',
      meta: true,
      action: handleOpenSettings,
      description: 'Open settings',
    },
    {
      key: ',',
      ctrl: true,
      action: handleOpenSettings,
      description: 'Open settings',
    },
    {
      key: 'r',
      meta: true,
      action: handleSync,
      description: 'Sync with server',
    },
    {
      key: 'r',
      ctrl: true,
      action: handleSync,
      description: 'Sync with server',
    },
    {
      key: 'Backspace',
      meta: true,
      action: handleDelete,
      description: 'Delete selected task',
    },
    {
      key: 'Delete',
      action: handleDelete,
      description: 'Delete selected task',
    },
    {
      key: 'Enter',
      action: handleToggleComplete,
      description: 'Toggle task completion',
    },
    {
      key: 'Escape',
      action: handleEscape,
      description: 'Close editor / Clear search',
    },
    {
      key: 'ArrowUp',
      action: handleNavigateUp,
      description: 'Navigate to previous task',
    },
    {
      key: 'ArrowDown',
      action: handleNavigateDown,
      description: 'Navigate to next task',
    },
    {
      key: 'k',
      action: handleNavigateUp,
      description: 'Navigate to previous task (vim)',
    },
    {
      key: 'j',
      action: handleNavigateDown,
      description: 'Navigate to next task (vim)',
    },
  ];

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
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      // allow some shortcuts even in inputs
      const allowInInput = ['Escape'];
      
      if (isInput && !allowInInput.includes(e.key)) {
        return;
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : true;
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
            shortcut.action();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return { shortcuts };
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
