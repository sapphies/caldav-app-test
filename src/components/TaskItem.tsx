import { useSortable } from '@dnd-kit/sortable';
import Calendar from 'lucide-react/icons/calendar';
import CheckCircle2 from 'lucide-react/icons/check-circle-2';
import ChevronRight from 'lucide-react/icons/chevron-right';
import ChevronDown from 'lucide-react/icons/chevron-down';
import Trash2 from 'lucide-react/icons/trash-2';
import Edit2 from 'lucide-react/icons/edit-2';
import Share2 from 'lucide-react/icons/share-2';
import { useState } from 'react';
import { 
  useToggleTaskComplete, 
  useSetSelectedTask,
  useUIState,
  useAccounts,
  useSetActiveTag,
} from '@/hooks/queries';
import * as taskData from '@/lib/taskData';
import { useSettingsStore } from '@/store/settingsStore';
import { Task, Priority } from '@/types';
import { ExportModal } from './modals/ExportModal';
import { getContrastTextColor } from '../utils/color';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useConfirmTaskDelete } from '@/hooks/useConfirmTaskDelete';
import { pluralize } from '../utils/format';
import { getIconByName } from './IconPicker';
import { formatDueDate } from '@/utils/date';

interface TaskItemProps {
  task: Task;
  depth: number;
  ancestorIds: string[];
  isDragEnabled: boolean;
  isOverlay?: boolean;
}

const priorityColors: Record<Priority, string> = {
  high: 'border-red-400 bg-red-50 dark:bg-red-900/30',
  medium: 'border-amber-400 bg-amber-50 dark:bg-amber-900/30',
  low: 'border-blue-400 bg-blue-50 dark:bg-blue-900/30',
  none: 'border-transparent',
};

export function TaskItem({ task, depth, ancestorIds, isDragEnabled, isOverlay }: TaskItemProps) {
  const { data: uiState } = useUIState();
  const { data: accounts = [] } = useAccounts();
  const toggleTaskCompleteMutation = useToggleTaskComplete();
  const setSelectedTaskMutation = useSetSelectedTask();
  const setActiveTagMutation = useSetActiveTag();
  const { accentColor } = useSettingsStore();
  const { contextMenu, handleContextMenu, handleCloseContextMenu, setContextMenu } = useContextMenu();
  const [showExportModal, setShowExportModal] = useState(false);
  const { confirmAndDelete } = useConfirmTaskDelete();

  const selectedTaskId = uiState?.selectedTaskId ?? null;
  const activeCalendarId = uiState?.activeCalendarId ?? null;

  // get contrast color for checkbox checkmark
  const checkmarkColor = getContrastTextColor(accentColor);

  const childCount = taskData.countChildren(task.uid);
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  // helper to get tag by id
  const getTagById = (tagId: string) => taskData.getTags().find(t => t.id === tagId);

  // pass ancestorIds as data so it can be accessed in handleDragEnd
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDragEnabled,
    data: { ancestorIds },
  });

  // only use translate, not scale, to avoid layout shifts
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  const isSelected = selectedTaskId === task.id;
  const taskTags = (task.tags || []).map(tagId => getTagById(tagId)).filter(Boolean);
  const calendar = accounts.flatMap((a) => a.calendars).find((c) => c.id === task.calendarId);
  const showCalendar = activeCalendarId === null && calendar;
  const calendarColor = calendar?.color ?? '#475569';
  const dueDateDisplay = task.dueDate ? formatDueDate(task.dueDate) : null;

  const handleClick = (e: React.MouseEvent) => {
    // don't select if clicking the checkbox or collapse button
    if ((e.target as HTMLElement).closest('.task-checkbox-wrapper') ||
        (e.target as HTMLElement).closest('.collapse-button')) {
      return;
    }
    setSelectedTaskMutation.mutate(task.id);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleTaskCompleteMutation.mutate(task.id);
  };

  const handleDelete = async () => {
    // Close context menu before opening the confirm dialog so Esc only targets the dialog
    setContextMenu(null);
    const deleted = await confirmAndDelete(task.id);
    if (deleted) {
      setContextMenu(null);
    }
  };

  const handleExport = () => {
    const result = taskData.exportTaskAndChildren(task.id);
    if (result) {
      setShowExportModal(true);
    }
    setContextMenu(null);
  };

  const handleToggleCollapsed = (e: React.MouseEvent) => {
    e.stopPropagation();
    taskData.toggleTaskCollapsed(task.id);
  };

  // todo: implement duplicate functionality at some point

  // calculate left margin based on depth
  const marginLeft = depth * 24; // 24px per level
  const paddingLeft = 12 + (depth * 4);

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, marginLeft: `${marginLeft}px`, paddingLeft: `${paddingLeft}px` }}
        {...attributes}
        {...(isDragEnabled ? listeners : {})}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        data-context-menu
        className={`
          group relative flex items-start gap-3 pr-3 py-3 bg-white dark:bg-surface-800 rounded-lg border transition-all
          ${isDragging ? 'opacity-50' : ''}
          ${isOverlay ? 'shadow-xl' : 'shadow-sm hover:shadow-md'}
          ${isSelected ? 'ring-2 ring-primary-100 dark:ring-primary-900/50' : task.priority === 'none' ? 'border-surface-200 dark:border-surface-700' : ''}
          ${task.completed ? 'opacity-60' : ''}
          ${isDragEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
          ${priorityColors[task.priority]}
        `}
      >
        <div className="task-checkbox-wrapper flex-shrink-0" onClick={handleCheckboxClick}>
          <button
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-all
              ${task.completed 
                ? 'bg-primary-500 border-primary-500' 
                : 'border-surface-300 dark:border-surface-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'
              }
            `}
          >
            {task.completed && <CheckCircle2 className="w-4 h-4" style={{ color: checkmarkColor }} />}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium leading-5 ${task.completed ? 'line-through text-surface-400' : 'text-surface-800 dark:text-surface-200'}`}>
            {task.title || <span className="text-surface-400 italic">Untitled task</span>}
          </div>

          {task.description && (
            <div className={`text-xs mt-1 line-clamp-1 ${task.completed ? 'text-surface-400 dark:text-surface-500' : 'text-surface-500 dark:text-surface-400'}`}>
              {task.description}
            </div>
          )}

          {(taskTags.length > 0 || showCalendar || task.dueDate || totalSubtasks > 0 || childCount > 0) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {taskTags.map((tag) => {
                if (!tag) return null;
                const TagIcon = getIconByName(tag.icon || 'tag');
                return (
                  <button
                    key={tag.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTagMutation.mutate(tag.id);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ 
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    <TagIcon className="w-3 h-3" />
                    {tag.name}
                  </button>
                );
              })}

              {showCalendar && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${calendarColor}20`, color: calendarColor }}
                >
                  <Calendar className="w-3 h-3" />
                  {calendar?.displayName || 'Calendar'}
                </span>
              )}

              {dueDateDisplay && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${dueDateDisplay.className}`}>
                  <Calendar className="w-3 h-3" />
                  {dueDateDisplay.text}
                </span>
              )}

              {totalSubtasks > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
                  <CheckCircle2 className="w-3 h-3" />
                  {completedSubtasks}/{totalSubtasks}
                </span>
              )}

              {childCount > 0 && (
                <button
                  onClick={handleToggleCollapsed}
                  className="collapse-button inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-xs text-surface-500 dark:text-surface-400"
                >
                  {task.isCollapsed ? (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      <span>{childCount} {pluralize(childCount, 'subtask')}</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      <span>{childCount} {pluralize(childCount, 'subtask')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-surface-300 dark:text-surface-600 group-hover:text-surface-500 dark:group-hover:text-surface-400 transition-colors flex-shrink-0" />
      </div>

      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={handleCloseContextMenu}
            onContextMenu={(e) => { e.preventDefault(); handleCloseContextMenu(); }}
          />
          <div
            data-context-menu-content
            className="fixed bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-50 min-w-[160px] animate-scale-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { setSelectedTaskMutation.mutate(task.id); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            {/* todo: implement duplicate func. low priority rn */}
            <button
              onClick={() => { toggleTaskCompleteMutation.mutate(task.id); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              {task.completed ? 'Mark Incomplete' : 'Mark Complete'}
            </button>
            <div className="border-t border-surface-200 dark:border-surface-700 my-1" />
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              <Share2 className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {showExportModal && (
        <ExportModal
          tasks={[task, ...(taskData.exportTaskAndChildren(task.id)?.descendants || [])]}
          fileName={task.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'task'}
          type="tasks"
          onClose={() => setShowExportModal(false)}
        />
      )}
    </>
  );
}
