import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query keys
export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    byCalendar: (calendarId: string) => ['tasks', 'calendar', calendarId] as const,
    byTag: (tagId: string) => ['tasks', 'tag', tagId] as const,
    byId: (id: string) => ['tasks', 'id', id] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    byId: (id: string) => ['accounts', id] as const,
  },
  tags: {
    all: ['tags'] as const,
    byId: (id: string) => ['tags', id] as const,
  },
  pendingDeletions: ['pendingDeletions'] as const,
  ui: {
    activeCalendar: ['ui', 'activeCalendar'] as const,
    activeTag: ['ui', 'activeTag'] as const,
    activeAccount: ['ui', 'activeAccount'] as const,
    selectedTask: ['ui', 'selectedTask'] as const,
    editorOpen: ['ui', 'editorOpen'] as const,
    searchQuery: ['ui', 'searchQuery'] as const,
    sortConfig: ['ui', 'sortConfig'] as const,
    showCompleted: ['ui', 'showCompleted'] as const,
  },
} as const;
