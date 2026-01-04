/**
 * TanStack Query hooks for UI state
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as taskData from '@/lib/taskData';
import { SortConfig } from '@/types';
import { useEffect } from 'react';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get the full UI state
 */
export function useUIState() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
    });
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['uiState'],
    queryFn: () => taskData.getUIState(),
    staleTime: Infinity,
  });
}

/**
 * Hook to get active calendar ID
 */
export function useActiveCalendarId() {
  const { data: uiState } = useUIState();
  return uiState?.activeCalendarId ?? null;
}

/**
 * Hook to get active tag ID
 */
export function useActiveTagId() {
  const { data: uiState } = useUIState();
  return uiState?.activeTagId ?? null;
}

/**
 * Hook to get active account ID
 */
export function useActiveAccountId() {
  const { data: uiState } = useUIState();
  return uiState?.activeAccountId ?? null;
}

/**
 * Hook to get selected task ID
 */
export function useSelectedTaskId() {
  const { data: uiState } = useUIState();
  return uiState?.selectedTaskId ?? null;
}

/**
 * Hook to get editor open state
 */
export function useIsEditorOpen() {
  const { data: uiState } = useUIState();
  return uiState?.isEditorOpen ?? false;
}

/**
 * Hook to get search query
 */
export function useSearchQuery() {
  const { data: uiState } = useUIState();
  return uiState?.searchQuery ?? '';
}

/**
 * Hook to get sort config
 */
export function useSortConfig() {
  const { data: uiState } = useUIState();
  return uiState?.sortConfig ?? { mode: 'manual' as const, direction: 'asc' as const };
}

/**
 * Hook to get show completed tasks setting
 */
export function useShowCompletedTasks() {
  const { data: uiState } = useUIState();
  return uiState?.showCompletedTasks ?? true;
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to set active account
 */
export function useSetActiveAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | null) => {
      taskData.setActiveAccount(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
    },
  });
}

/**
 * Hook to set active calendar
 */
export function useSetActiveCalendar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | null) => {
      taskData.setActiveCalendar(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
      queryClient.invalidateQueries({ queryKey: ['filteredTasks'] });
    },
  });
}

/**
 * Hook to set active tag
 */
export function useSetActiveTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | null) => {
      taskData.setActiveTag(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
      queryClient.invalidateQueries({ queryKey: ['filteredTasks'] });
    },
  });
}

/**
 * Hook to set all tasks view
 */
export function useSetAllTasksView() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => {
      taskData.setAllTasksView();
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
      queryClient.invalidateQueries({ queryKey: ['filteredTasks'] });
    },
  });
}

/**
 * Hook to set selected task
 */
export function useSetSelectedTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string | null) => {
      taskData.setSelectedTask(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
    },
  });
}

/**
 * Hook to set editor open state
 */
export function useSetEditorOpen() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (open: boolean) => {
      taskData.setEditorOpen(open);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
    },
  });
}

/**
 * Hook to set search query
 */
export function useSetSearchQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (query: string) => {
      taskData.setSearchQuery(query);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
      queryClient.invalidateQueries({ queryKey: ['filteredTasks'] });
    },
  });
}

/**
 * Hook to set sort config
 */
export function useSetSortConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (config: SortConfig) => {
      taskData.setSortConfig(config);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
    },
  });
}

/**
 * Hook to set show completed tasks
 */
export function useSetShowCompletedTasks() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (show: boolean) => {
      taskData.setShowCompletedTasks(show);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uiState'] });
      queryClient.invalidateQueries({ queryKey: ['filteredTasks'] });
    },
  });
}
