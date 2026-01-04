/**
 * TanStack Query hooks for tasks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import * as taskData from '@/lib/taskData';
import { Task, Subtask, SortConfig } from '@/types';
import { useEffect } from 'react';
import { FlattenedTask } from '@/utils/tree';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get all tasks
 */
export function useTasks() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    });
  }, [queryClient]);
  
  return useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: () => taskData.getAllTasks(),
    staleTime: Infinity, // Data is managed by our data layer
  });
}

/**
 * Hook to get filtered tasks based on current UI state
 */
export function useFilteredTasks() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      queryClient.invalidateQueries({ queryKey: ['filteredTasks'] });
    });
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['filteredTasks'],
    queryFn: () => taskData.getFilteredTasks(),
    staleTime: Infinity,
  });
}

/**
 * Hook to get sorted tasks
 */
export function useSortedTasks(tasks: Task[], sortConfig?: SortConfig) {
  return useQuery({
    queryKey: ['sortedTasks', tasks.map(t => t.id), sortConfig],
    queryFn: () => taskData.getSortedTasks(tasks, sortConfig),
    staleTime: Infinity,
  });
}

/**
 * Hook to get a single task by ID
 */
export function useTask(id: string | null) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byId(id) });
      }
    });
  }, [queryClient, id]);
  
  return useQuery({
    queryKey: queryKeys.tasks.byId(id || ''),
    queryFn: () => id ? taskData.getTaskById(id) : undefined,
    enabled: !!id,
    staleTime: Infinity,
  });
}

/**
 * Hook to get tasks by calendar
 */
export function useTasksByCalendar(calendarId: string | null) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      if (calendarId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byCalendar(calendarId) });
      }
    });
  }, [queryClient, calendarId]);
  
  return useQuery({
    queryKey: queryKeys.tasks.byCalendar(calendarId || ''),
    queryFn: () => calendarId ? taskData.getTasksByCalendar(calendarId) : [],
    enabled: !!calendarId,
    staleTime: Infinity,
  });
}

/**
 * Hook to get child tasks
 */
export function useChildTasks(parentUid: string | undefined) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      if (parentUid) {
        queryClient.invalidateQueries({ queryKey: ['childTasks', parentUid] });
      }
    });
  }, [queryClient, parentUid]);
  
  return useQuery({
    queryKey: ['childTasks', parentUid || ''],
    queryFn: () => parentUid ? taskData.getChildTasks(parentUid) : [],
    enabled: !!parentUid,
    staleTime: Infinity,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (taskInput: Partial<Task>) => {
      return Promise.resolve(taskData.createTask(taskInput));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

/**
 * Hook to update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      return Promise.resolve(taskData.updateTask(id, updates));
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byId(id) });
    },
  });
}

/**
 * Hook to delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, deleteChildren = true }: { id: string; deleteChildren?: boolean }) => {
      taskData.deleteTask(id, deleteChildren);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

/**
 * Hook to toggle task completion
 */
export function useToggleTaskComplete() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => {
      taskData.toggleTaskComplete(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

/**
 * Hook to toggle task collapsed state
 */
export function useToggleTaskCollapsed() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => {
      taskData.toggleTaskCollapsed(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

/**
 * Hook to set task parent
 */
export function useSetTaskParent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, parentUid }: { taskId: string; parentUid: string | undefined }) => {
      taskData.setTaskParent(taskId, parentUid);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

/**
 * Hook to reorder tasks
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      activeId,
      overId,
      flattenedItems,
      targetIndent,
    }: {
      activeId: string;
      overId: string;
      flattenedItems: FlattenedTask[];
      targetIndent?: number;
    }) => {
      taskData.reorderTasks(activeId, overId, flattenedItems, targetIndent);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

// ============================================================================
// Subtask Mutations
// ============================================================================

export function useAddSubtask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, title }: { taskId: string; title: string }) => {
      taskData.addSubtask(taskId, title);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, subtaskId, updates }: { taskId: string; subtaskId: string; updates: Partial<Subtask> }) => {
      taskData.updateSubtask(taskId, subtaskId, updates);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) => {
      taskData.deleteSubtask(taskId, subtaskId);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useToggleSubtaskComplete() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) => {
      taskData.toggleSubtaskComplete(taskId, subtaskId);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

// ============================================================================
// Tag Mutations on Tasks
// ============================================================================

export function useAddTagToTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) => {
      taskData.addTagToTask(taskId, tagId);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useRemoveTagFromTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) => {
      taskData.removeTagFromTask(taskId, tagId);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

// ============================================================================
// Reminder Mutations
// ============================================================================

export function useAddReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, trigger }: { taskId: string; trigger: Date }) => {
      taskData.addReminder(taskId, trigger);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useRemoveReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, reminderId }: { taskId: string; reminderId: string }) => {
      taskData.removeReminder(taskId, reminderId);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, reminderId, trigger }: { taskId: string; reminderId: string; trigger: Date }) => {
      taskData.updateReminder(taskId, reminderId, trigger);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to count children of a task
 */
export function useCountChildren(parentUid: string | undefined) {
  return useQuery({
    queryKey: ['countChildren', parentUid || ''],
    queryFn: () => parentUid ? taskData.countChildren(parentUid) : 0,
    enabled: !!parentUid,
    staleTime: Infinity,
  });
}

/**
 * Hook to get all descendants
 */
export function useAllDescendants(parentUid: string | undefined) {
  return useQuery({
    queryKey: ['allDescendants', parentUid || ''],
    queryFn: () => parentUid ? taskData.getAllDescendants(parentUid) : [],
    enabled: !!parentUid,
    staleTime: Infinity,
  });
}

/**
 * Hook to export task and children
 */
export function useExportTaskAndChildren(taskId: string | null) {
  return useQuery({
    queryKey: ['exportTask', taskId || ''],
    queryFn: () => taskId ? taskData.exportTaskAndChildren(taskId) : null,
    enabled: !!taskId,
    staleTime: Infinity,
  });
}
