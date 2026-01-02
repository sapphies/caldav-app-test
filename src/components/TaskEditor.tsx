import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import X from 'lucide-react/icons/x';
import Trash2 from 'lucide-react/icons/trash-2';
import Calendar from 'lucide-react/icons/calendar';
import Clock from 'lucide-react/icons/clock';
import Flag from 'lucide-react/icons/flag';
import Plus from 'lucide-react/icons/plus';
import CheckCircle2 from 'lucide-react/icons/check-circle-2';
import Tag from 'lucide-react/icons/tag';
import FolderSync from 'lucide-react/icons/folder-sync';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Task, Priority } from '@/types';
import { DateTimePicker } from './DateTimePicker';
import { getContrastTextColor } from '../utils/color';
import { useConfirmTaskDelete } from '@/hooks/useConfirmTaskDelete';
import { getIconByName } from './IconPicker';

interface TaskEditorProps {
  task: Task;
}

const priorities: { value: Priority; label: string; color: string; borderColor: string; bgColor: string }[] = [
  { value: 'high', label: 'High', color: 'text-red-500', borderColor: 'border-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30' },
  { value: 'medium', label: 'Medium', color: 'text-amber-500', borderColor: 'border-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
  { value: 'low', label: 'Low', color: 'text-blue-500', borderColor: 'border-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
  { value: 'none', label: 'None', color: 'text-surface-400', borderColor: 'border-surface-300', bgColor: 'bg-surface-50 dark:bg-surface-700' },
];

export function TaskEditor({ task }: TaskEditorProps) {
  const {
    updateTask,
    setEditorOpen,
    tags,
    updateSubtask,
    deleteSubtask,
    toggleSubtaskComplete,
    addTask,
    getChildTasks,
    countChildren,
    addTagToTask,
    removeTagFromTask,
    getTagById,
    accounts,
  } = useTaskStore();
  const { accentColor } = useSettingsStore();
  const { confirmAndDelete } = useConfirmTaskDelete();

  // get contrast color for checkbox checkmarks
  const checkmarkColor = getContrastTextColor(accentColor);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const childTasks = getChildTasks(task.uid);
  const childCount = countChildren(task.uid);
  const taskTags = (task.tags || []).map(tagId => getTagById(tagId)).filter(Boolean);
  const availableTags = tags.filter(t => !(task.tags || []).includes(t.id));

  // Get current calendar info
  const currentAccount = accounts.find(a => a.id === task.accountId);
  const currentCalendar = currentAccount?.calendars.find(c => c.id === task.calendarId);
  
  // Get all available calendars for moving
  const allCalendars = accounts.flatMap(account => 
    account.calendars.map(cal => ({
      ...cal,
      accountId: account.id,
      accountName: account.name,
    }))
  );

  // focus title on open if empty
  useEffect(() => {
    if (!task.title && titleRef.current) {
      titleRef.current.focus();
    }
  }, [task.id]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTask(task.id, { title: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateTask(task.id, { description: e.target.value });
  };

  const handlePriorityChange = (priority: Priority) => {
    updateTask(task.id, { priority });
  };

  const handleCalendarChange = (calendarId: string) => {
    const targetCalendar = allCalendars.find(c => c.id === calendarId);
    if (targetCalendar) {
      updateTask(task.id, { 
        calendarId: targetCalendar.id,
        accountId: targetCalendar.accountId,
      });
    }
  };

  const handleStartDateChange = (date: Date | undefined) => {
    updateTask(task.id, { startDate: date });
  };

  const handleDueDateChange = (date: Date | undefined) => {
    updateTask(task.id, { dueDate: date });
  };

  const handleAddChildTask = () => {
    if (newSubtaskTitle.trim()) {
      // create a new task with parentUid set to this task's UID
      addTask({
        title: newSubtaskTitle.trim(),
        parentUid: task.uid,
        accountId: task.accountId,
        calendarId: task.calendarId,
        priority: 'none',
      });
      setNewSubtaskTitle('');
    }
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddChildTask();
    }
  };

  const handleDelete = async () => {
    const deleted = await confirmAndDelete(task.id);
    if (deleted) {
      setEditorOpen(false);
    }
  };

  return (
    <div className={`flex flex-col h-full`}>
      <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
        <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">Edit Task</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="p-2 text-surface-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setEditorOpen(false)}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 flex overscroll-contain flex-col">
        <div>
          <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
            Title
          </label>
          <input
            ref={titleRef}
            type="text"
            value={task.title}
            onChange={handleTitleChange}
            placeholder="Task title..."
            className="w-full text-xl font-semibold text-surface-800 dark:text-surface-200 placeholder:text-surface-400 border-0 focus:outline-none focus:ring-0 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
            Description
          </label>
          <textarea
            value={task.description}
            onChange={handleDescriptionChange}
            placeholder="Add a description..."
            rows={4}
            className="w-full px-3 py-2 text-sm text-surface-700 dark:text-surface-300 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50 resize-none"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
              <Clock className="w-4 h-4" />
              Start Date
            </label>
            <DateTimePicker
              value={task.startDate ? new Date(task.startDate) : undefined}
              onChange={handleStartDateChange}
              placeholder="Set start date..."
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
              <Calendar className="w-4 h-4" />
              Due Date
            </label>
            <DateTimePicker
              value={task.dueDate ? new Date(task.dueDate) : undefined}
              onChange={handleDueDateChange}
              placeholder="Set due date..."
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
            <Flag className="w-4 h-4" />
            Priority
          </label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePriorityChange(p.value)}
                className={`
                  flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                  ${task.priority === p.value
                    ? `${p.borderColor} ${p.bgColor}`
                    : 'border-surface-200 dark:border-surface-600 hover:border-surface-300 text-surface-600 dark:text-surface-400'
                  }
                `}
              >
                <span className={p.color}>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
            <FolderSync className="w-4 h-4" />
            Calendar
          </label>
          <select
            value={task.calendarId}
            onChange={(e) => handleCalendarChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
          >
            {accounts.map((account) => (
              <optgroup key={account.id} label={account.name}>
                {account.calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {currentCalendar && currentAccount && (
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
              Currently in: {currentAccount.name} / {currentCalendar.displayName}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
            <Tag className="w-4 h-4" />
            Tag
          </label>
          <div className="flex flex-wrap gap-2">
            {taskTags.map((tag) => {
              if (!tag) return null;
              const TagIcon = getIconByName(tag.icon || 'tag');
              return (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs font-medium group"
                  style={{ 
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  <TagIcon className="w-3 h-3" />
                  {tag.name}
                  <button
                    onClick={() => removeTagFromTask(task.id, tag.id)}
                    className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            
            <div className="relative">
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-surface-500 dark:text-surface-400 border border-dashed border-surface-300 dark:border-surface-600 rounded-full hover:border-surface-400 dark:hover:border-surface-500 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add tag
              </button>
                
                {showTagPicker && availableTags.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowTagPicker(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-1 min-w-[150px]">
                      {availableTags.map((tag) => {
                        const TagIcon = getIconByName(tag.icon || 'tag');
                        return (
                          <button
                            key={tag.id}
                            onClick={() => {
                              addTagToTask(task.id, tag.id);
                              setShowTagPicker(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                            style={{ color: tag.color }}
                          >
                            <TagIcon className="w-4 h-4" />
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                
              {showTagPicker && availableTags.length === 0 && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowTagPicker(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 py-2 px-3 min-w-[150px]">
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {tags.length === 0 ? 'No tags created yet' : 'All tags assigned'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400">
              <CheckCircle2 className="w-4 h-4" />
              Subtasks {childCount > 0 && `(${childCount})`}
            </label>
          </div>

          <div className="space-y-2">
            {childTasks.map((childTask) => (
              <div
                key={childTask.id}
                className="flex items-center gap-2 group pl-2 border-l-2 border-primary-200 dark:border-primary-800"
              >
                <button
                  onClick={() => updateTask(childTask.id, { completed: !childTask.completed })}
                  className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0
                    ${childTask.completed
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-surface-300 dark:border-surface-600 hover:border-primary-400'
                    }
                  `}
                >
                  {childTask.completed && <CheckCircle2 className="w-3 h-3" style={{ color: checkmarkColor }} />}
                </button>
                <span
                  className={`
                    flex-1 text-sm
                    ${childTask.completed ? 'line-through text-surface-400' : 'text-surface-700 dark:text-surface-300'}
                  `}
                >
                  {childTask.title}
                </span>
                <button
                  onClick={() => confirmAndDelete(childTask.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {task.subtasks.length > 0 && (
              <div className="pt-2 border-t border-surface-200 dark:border-surface-700">
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                  <Flag className="w-3 h-3" />
                  Legacy subtasks (will be migrated)
                </div>
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 group opacity-60"
                  >
                    <button
                      onClick={() => toggleSubtaskComplete(task.id, subtask.id)}
                      className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0
                        ${subtask.completed
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-surface-300 dark:border-surface-600 hover:border-primary-400'
                        }
                      `}
                    >
                      {subtask.completed && <CheckCircle2 className="w-3 h-3" style={{ color: checkmarkColor }} />}
                    </button>
                    <input
                      type="text"
                      value={subtask.title}
                      onChange={(e) => updateSubtask(task.id, subtask.id, { title: e.target.value })}
                      className={`
                        flex-1 px-2 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0
                        ${subtask.completed ? 'line-through text-surface-400' : 'text-surface-700 dark:text-surface-300'}
                      `}
                    />
                    <button
                      onClick={() => deleteSubtask(task.id, subtask.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <Plus className="w-5 h-5 text-surface-400" />
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={handleSubtaskKeyDown}
                placeholder="Add a subtask..."
                className="flex-1 px-2 py-1 text-sm text-surface-700 dark:text-surface-300 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-surface-400"
              />
              {newSubtaskTitle && (
                <button
                  onClick={handleAddChildTask}
                  className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-surface-200 dark:border-surface-700 text-xs text-surface-400">
        <div>Created: {format(new Date(task.createdAt), 'PPp')}</div>
        <div>Modified: {format(new Date(task.modifiedAt), 'PPp')}</div>
      </div>
    </div>
  );
}
