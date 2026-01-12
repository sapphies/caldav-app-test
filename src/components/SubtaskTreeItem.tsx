import Check from 'lucide-react/icons/check';
import ChevronDown from 'lucide-react/icons/chevron-down';
import ChevronRight from 'lucide-react/icons/chevron-right';
import X from 'lucide-react/icons/x';
import type { Priority, Task } from '@/types';

const priorityDots: Record<Priority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
  none: '',
};

interface SubtaskTreeItemProps {
  task: Task;
  depth: number;
  checkmarkColor: string;
  expandedSubtasks: Set<string>;
  setExpandedSubtasks: React.Dispatch<React.SetStateAction<Set<string>>>;
  updateTask: (id: string, updates: Partial<Task>) => void;
  confirmAndDelete: (id: string) => Promise<boolean>;
  getChildTasks: (parentUid: string) => Task[];
  countChildren: (parentUid: string) => number;
}

export function SubtaskTreeItem({
  task,
  depth,
  checkmarkColor,
  expandedSubtasks,
  setExpandedSubtasks,
  updateTask,
  confirmAndDelete,
  getChildTasks,
  countChildren,
}: SubtaskTreeItemProps) {
  const childTasks = getChildTasks(task.uid);
  const childCount = countChildren(task.uid);
  const isExpanded = expandedSubtasks.has(task.id);

  // Calculate total descendants recursively
  const getTotalDescendants = (parentUid: string): number => {
    const children = getChildTasks(parentUid);
    return children.reduce((acc, child) => acc + 1 + getTotalDescendants(child.uid), 0);
  };
  const totalDescendants = getTotalDescendants(task.uid);

  const toggleExpanded = () => {
    setExpandedSubtasks((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      return next;
    });
  };

  return (
    <div>
      <div
        className="group/row flex items-center gap-2 py-1 hover:bg-surface-50 dark:hover:bg-surface-800/50 rounded"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        {childCount > 0 ? (
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-xs text-surface-500 dark:text-surface-400"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span>{totalDescendants}</span>
          </button>
        ) : (
          <div className="w-[34px]" />
        )}

        {/* Priority indicator */}
        {task.priority !== 'none' && (
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDots[task.priority]}`} />
        )}

        {/* Checkbox */}
        <button
          type="button"
          onClick={() => updateTask(task.id, { completed: !task.completed })}
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
            ${
              task.completed
                ? 'bg-primary-500 border-primary-500'
                : 'border-surface-300 dark:border-surface-600 hover:border-primary-400'
            }
          `}
        >
          {task.completed && (
            <Check className="w-3 h-3" style={{ color: checkmarkColor }} strokeWidth={3} />
          )}
        </button>

        {/* Title */}
        <span
          className={`
            flex-1 text-sm truncate
            ${task.completed ? 'line-through text-surface-400' : 'text-surface-700 dark:text-surface-300'}
          `}
        >
          {task.title || <span className="text-surface-400 italic">Untitled</span>}
        </span>

        {/* Delete button */}
        <button
          type="button"
          onClick={async () => {
            await confirmAndDelete(task.id);
          }}
          className="invisible group-hover/row:visible p-1 flex-shrink-0 text-surface-400 hover:!text-red-500 dark:hover:!text-red-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nested children */}
      {isExpanded && childTasks.length > 0 && (
        <div style={{ marginLeft: `${depth * 16 + 24}px` }}>
          {childTasks.map((childTask) => (
            <SubtaskTreeItem
              key={childTask.id}
              task={childTask}
              depth={depth + 1}
              checkmarkColor={checkmarkColor}
              expandedSubtasks={expandedSubtasks}
              setExpandedSubtasks={setExpandedSubtasks}
              updateTask={updateTask}
              confirmAndDelete={confirmAndDelete}
              getChildTasks={getChildTasks}
              countChildren={countChildren}
            />
          ))}
        </div>
      )}
    </div>
  );
}
