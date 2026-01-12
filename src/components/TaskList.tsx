import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ListTodo from 'lucide-react/icons/list-todo';
import Plus from 'lucide-react/icons/plus';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useCreateTask,
  useFilteredTasks,
  useReorderTasks,
  useSetSelectedTask,
  useUIState,
} from '@/hooks/queries';
import { createLogger } from '@/lib/logger';
import * as taskData from '@/lib/taskData';
import { getMetaKeyLabel, getModifierJoiner } from '../utils/keyboard';
import { type FlattenedTask, flattenTasks } from '../utils/tree';
import { TaskItem } from './TaskItem';

const log = createLogger('TaskList', '#14b8a6');

import { setIsKeyboardDragging } from '@/lib/dragState';

// pixels of horizontal drag per indent level
const INDENT_SHIFT_SIZE = 28;

// Disable drop animation entirely to prevent visual conflict
// When we drop, items should instantly appear in their new positions
const dropAnimation = null;

export function TaskList() {
  const { data: uiState } = useUIState();
  const { data: filteredTasksData = [] } = useFilteredTasks();
  const createTaskMutation = useCreateTask();
  const setSelectedTaskMutation = useSetSelectedTask();
  const reorderTasksMutation = useReorderTasks();

  const sortConfig = uiState?.sortConfig ?? { mode: 'manual' as const, direction: 'asc' as const };
  const searchQuery = uiState?.searchQuery ?? '';
  const showCompletedTasks = uiState?.showCompletedTasks ?? true;

  const [activeTask, setActiveTask] = useState<FlattenedTask | null>(null);
  const [targetIndent, setTargetIndent] = useState<number>(0);
  const [targetParentName, setTargetParentName] = useState<string | null>(null);

  // track the starting X position and original indent
  const dragStartXRef = useRef<number>(0);
  const originalIndentRef = useRef<number>(0);

  const filteredTasks = filteredTasksData;

  // filter out child tasks - top level only for the root
  const topLevelTasks = useMemo(
    () => filteredTasks.filter((task) => !task.parentUid),
    [filteredTasks],
  );

  const sortedTasks = useMemo(
    () => taskData.getSortedTasks(topLevelTasks, sortConfig),
    [topLevelTasks, sortConfig],
  );

  const getFilteredChildTasks = useCallback(
    (parentUid: string) => {
      const children = taskData.getChildTasks(parentUid);
      if (!showCompletedTasks) {
        return children.filter((task) => !task.completed);
      }
      return children;
    },
    [showCompletedTasks],
  );

  // flatten the tree into a single list with depth info
  const flattenedTasks = useMemo(
    () =>
      flattenTasks(sortedTasks, getFilteredChildTasks, (tasks) =>
        taskData.getSortedTasks(tasks, sortConfig),
      ),
    [sortedTasks, getFilteredChildTasks, sortConfig],
  );

  // Clear active task if it no longer exists (e.g., was deleted during drag)
  useEffect(() => {
    if (activeTask && !flattenedTasks.find((t) => t.id === activeTask.id)) {
      setActiveTask(null);
      setTargetIndent(0);
      setTargetParentName(null);
    }
  }, [activeTask, flattenedTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // find the task that would become the parent at a given indent level
  const findParentTaskName = (
    overIndex: number,
    activeId: string,
    activeIndex: number,
    indent: number,
  ): string | null => {
    if (indent === 0) return null;

    // we need to find which task would be the parent at this indent level
    // look backwards from the target position to find a task at (indent - 1) depth
    let searchIndex: number;
    if (activeIndex < overIndex) {
      // moving down - look at the task currently at overIndex
      searchIndex = overIndex;
    } else if (activeIndex > overIndex) {
      // moving up - look at the task at overIndex - 1
      searchIndex = overIndex - 1;
    } else {
      // not moving vertically - look at the task above current position
      searchIndex = activeIndex - 1;
    }

    for (let i = searchIndex; i >= 0; i--) {
      const task = flattenedTasks[i];
      if (task.id !== activeId && task.depth === indent - 1) {
        return task.title || 'Untitled task';
      }
    }
    return null;
  };

  // truncate task name if too long
  const truncateName = (name: string, maxLength: number = 20): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 1) + '…';
  };

  // calculate the max indent allowed at a given position
  const getMaxIndentAtPosition = (
    overIndex: number,
    activeId: string,
    activeIndex: number,
  ): number => {
    // if we're at position 0 and not moving, or moving to position 0
    if (overIndex <= 0 && activeIndex === 0) return 0;
    if (overIndex === 0 && activeIndex !== 0) return 0;

    // when checking indent bounds, we need to consider where the task will actually end up
    // if activeIndex < overIndex, the task above will be at overIndex (since active moves down)
    // if activeIndex > overIndex, the task above will be at overIndex - 1
    // if activeIndex === overIndex, look at the task directly above the current position

    let taskAboveIndex: number;
    if (activeIndex < overIndex) {
      // moving down - look at the task currently at overIndex
      taskAboveIndex = overIndex;
    } else if (activeIndex > overIndex) {
      // moving up - look at the task at overIndex - 1
      taskAboveIndex = overIndex - 1;
    } else {
      // not moving vertically - look at the task above current position
      taskAboveIndex = activeIndex - 1;
    }

    if (taskAboveIndex < 0) return 0;

    // find the first non-dragged task at or before this index
    for (let i = taskAboveIndex; i >= 0; i--) {
      const task = flattenedTasks[i];
      if (task.id !== activeId) {
        // can be at most one level deeper than this task task
        return task.depth + 1;
      }
    }
    return 0;
  };

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = flattenedTasks.find((t) => t.id === event.active.id);
      if (task) {
        setActiveTask(task);
        originalIndentRef.current = task.depth;
        setTargetIndent(task.depth);
        // store starting X from the event
        const pointerEvent = event.activatorEvent as PointerEvent;
        dragStartXRef.current = pointerEvent?.clientX ?? 0;

        // track if this is a keyboard-initiated drag
        // KeyboardEvent is used by dnd-kit KeyboardSensor, PointerEvent by PointerSensor
        if (event.activatorEvent instanceof KeyboardEvent) {
          setIsKeyboardDragging(true);
        }
      }
    },
    [flattenedTasks],
  );

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;

    if (!activeTask || !over) {
      return;
    }

    const activeIndex = flattenedTasks.findIndex((t) => t.id === active.id);
    const overIndex = flattenedTasks.findIndex((t) => t.id === over.id);

    if (activeIndex === -1 || overIndex === -1) return;

    // get current pointer X position
    // delta.x is cumulative horizontal movement from drag start
    const deltaX = event.delta.x;

    // calculate indent change based on horizontal drag
    const indentDelta = Math.round(deltaX / INDENT_SHIFT_SIZE);

    // calculate bounds - pass activeIndex for proper calculation
    const maxIndent = getMaxIndentAtPosition(overIndex, active.id as string, activeIndex);
    const minIndent = 0;

    // apply indent change from original position
    const newIndent = Math.max(
      minIndent,
      Math.min(maxIndent, originalIndentRef.current + indentDelta),
    );

    setTargetIndent(newIndent);

    // calculate which task would become the parent
    const parentName = findParentTaskName(overIndex, active.id as string, activeIndex, newIndent);
    setTargetParentName(parentName);
  };

  const handleDragCancel = useCallback(() => {
    // reset all drag state on cancel
    setActiveTask(null);
    setTargetIndent(0);
    setTargetParentName(null);
    setIsKeyboardDragging(false);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const finalTargetIndent = targetIndent;

      // reset state
      setActiveTask(null);
      setTargetIndent(0);
      setTargetParentName(null);
      setIsKeyboardDragging(false);

      if (!over) return;

      // even if dropping on same item, we might be changing indent
      const activeIndex = flattenedTasks.findIndex((t) => t.id === active.id);
      const overIndex = flattenedTasks.findIndex((t) => t.id === over.id);

      if (activeIndex === -1 || overIndex === -1) return;

      // get ancestor info from the data
      const overAncestorIds = (over.data.current?.ancestorIds as string[]) || [];

      // prevent dropping into own descendants
      if (overAncestorIds.includes(active.id as string)) {
        log.debug('Cannot drop item into its descendant');
        return;
      }

      // check if anything actually changed
      const activeItem = flattenedTasks[activeIndex];
      const positionChanged = active.id !== over.id;
      const indentChanged = activeItem.depth !== finalTargetIndent;

      if (!positionChanged && !indentChanged) {
        return;
      }

      // call reorder with the final target indent
      reorderTasksMutation.mutate({
        activeId: active.id as string,
        overId: over.id as string,
        flattenedItems: flattenedTasks,
        targetIndent: finalTargetIndent,
      });
    },
    [flattenedTasks, reorderTasksMutation, targetIndent],
  );

  const handleQuickAdd = () => {
    createTaskMutation.mutate(
      { title: '' },
      {
        onSuccess: (task) => {
          setSelectedTaskMutation.mutate(task.id);
        },
      },
    );
  };

  const metaKey = getMetaKeyLabel();
  const modifierJoiner = getModifierJoiner();
  const newTaskShortcut = `${metaKey}${modifierJoiner}N`;

  // only enable dragging for manual/smart sort modes
  const isDragEnabled = sortConfig.mode === 'manual' || sortConfig.mode === 'smart';

  if (flattenedTasks.length === 0) {
    const isSearching = searchQuery.trim().length > 0;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <ListTodo className="w-16 h-16 text-surface-300 dark:text-surface-600 mb-4" />
        <h3 className="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
          {isSearching ? 'No tasks found' : 'No tasks yet'}
        </h3>
        <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-sm">
          {isSearching ? (
            'No tasks match your search query. Try adjusting your search terms.'
          ) : (
            <>
              Create your first task to get started. Press{' '}
              <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-sm font-mono">
                {newTaskShortcut}
              </kbd>{' '}
              or click the button below.
            </>
          )}
        </p>
        {!isSearching && (
          <button
            type="button"
            onClick={handleQuickAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 overscroll-contain">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={flattenedTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
          disabled={!isDragEnabled}
        >
          <div className="space-y-1.5">
            {flattenedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                depth={task.depth}
                ancestorIds={task.ancestorIds}
                isDragEnabled={isDragEnabled}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <div className="drag-overlay relative" style={{ marginLeft: `${targetIndent * 24}px` }}>
              {targetIndent !== originalIndentRef.current && (
                <div className="absolute -top-6 left-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded shadow whitespace-nowrap">
                  {targetIndent > originalIndentRef.current
                    ? `→ Nest in ${truncateName(targetParentName || 'parent')}`
                    : targetIndent === 0
                      ? '← Move to root'
                      : `← Move under ${truncateName(targetParentName || 'parent')}`}
                </div>
              )}
              <TaskItem
                task={activeTask}
                depth={0}
                ancestorIds={[]}
                isDragEnabled={false}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <button
        type="button"
        onClick={handleQuickAdd}
        className="mt-4 w-full flex items-center gap-3 p-3 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors border-2 border-dashed border-surface-200 dark:border-surface-600 hover:border-surface-300 dark:hover:border-surface-500"
      >
        <Plus className="w-5 h-5" />
        <span>Add a task...</span>
      </button>
    </div>
  );
}
