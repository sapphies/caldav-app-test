/**
 * TanStack Query hooks for tags
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import * as taskData from '@/lib/taskData';
import { Tag } from '@/types';
import { useEffect } from 'react';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get all tags
 */
export function useTags() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    });
  }, [queryClient]);
  
  return useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => taskData.getAllTags(),
    staleTime: Infinity,
  });
}

/**
 * Hook to get a single tag by ID
 */
export function useTag(id: string | null) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tags.byId(id) });
      }
    });
  }, [queryClient, id]);
  
  return useQuery({
    queryKey: queryKeys.tags.byId(id || ''),
    queryFn: () => id ? taskData.getTagById(id) : undefined,
    enabled: !!id,
    staleTime: Infinity,
  });
}

/**
 * Hook to get tasks by tag
 */
export function useTasksByTag(tagId: string | null) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    return taskData.subscribeToDataChanges(() => {
      if (tagId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byTag(tagId) });
      }
    });
  }, [queryClient, tagId]);
  
  return useQuery({
    queryKey: queryKeys.tasks.byTag(tagId || ''),
    queryFn: () => tagId ? taskData.getTasksByTag(tagId) : [],
    enabled: !!tagId,
    staleTime: Infinity,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a tag
 */
export function useCreateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (tagInput: Partial<Tag>) => {
      return Promise.resolve(taskData.createTag(tagInput));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

/**
 * Hook to update a tag
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Tag> }) => {
      return Promise.resolve(taskData.updateTag(id, updates));
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.byId(id) });
    },
  });
}

/**
 * Hook to delete a tag
 */
export function useDeleteTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => {
      taskData.deleteTag(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}
