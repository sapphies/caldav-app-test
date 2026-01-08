import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import X from 'lucide-react/icons/x';
import Trash2 from 'lucide-react/icons/trash-2';
import Calendar from 'lucide-react/icons/calendar';
import Clock from 'lucide-react/icons/clock';
import Flag from 'lucide-react/icons/flag';
import Plus from 'lucide-react/icons/plus';
import Check from 'lucide-react/icons/check';
import CheckCircle2 from 'lucide-react/icons/check-circle-2';
import Tag from 'lucide-react/icons/tag';
import FolderSync from 'lucide-react/icons/folder-sync';
import Bell from 'lucide-react/icons/bell';
import Pencil from 'lucide-react/icons/pencil';
import { 
  useUpdateTask, 
  useSetEditorOpen,
  useTags,
  useCreateTask,
  useAccounts,
  useAddTagToTask,
  useRemoveTagFromTask,
  useAddReminder,
  useRemoveReminder,
  useUpdateReminder,
  useUpdateSubtask,
  useDeleteSubtask,
  useToggleSubtaskComplete,
} from '@/hooks/queries';
import * as taskData from '@/lib/taskData';
import { useSettingsStore } from '@/store/settingsStore';
import { Task, Priority } from '@/types';
import { getContrastTextColor } from '../utils/color';
import { useConfirmTaskDelete } from '@/hooks/useConfirmTaskDelete';
import { getIconByName } from './IconPicker';
import { SubtaskTreeItem } from './SubtaskTreeItem';
import { DatePickerModal } from './modals/DatePickerModal';
import { ReminderPickerModal } from './modals/ReminderPickerModal';
import { TagPickerModal } from './modals/TagPickerModal';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';

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
  const updateTaskMutation = useUpdateTask();
  const setEditorOpenMutation = useSetEditorOpen();
  const createTaskMutation = useCreateTask();
  const addTagToTaskMutation = useAddTagToTask();
  const removeTagFromTaskMutation = useRemoveTagFromTask();
  const addReminderMutation = useAddReminder();
  const removeReminderMutation = useRemoveReminder();
  const updateReminderMutation = useUpdateReminder();
  const updateSubtaskMutation = useUpdateSubtask();
  const deleteSubtaskMutation = useDeleteSubtask();
  const toggleSubtaskCompleteMutation = useToggleSubtaskComplete();
  const { data: tags = [] } = useTags();
  const { data: accounts = [] } = useAccounts();
  const { accentColor } = useSettingsStore();
  const { confirmAndDelete } = useConfirmTaskDelete();

  // get contrast color for checkbox checkmarks
  const checkmarkColor = getContrastTextColor(accentColor);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editReminderDate, setEditReminderDate] = useState<Date | undefined>(undefined);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const childTasks = taskData.getChildTasks(task.uid);
  const childCount = taskData.countChildren(task.uid);
  const taskTags = (task.tags || []).map(tagId => taskData.getTags().find(t => t.id === tagId)).filter(Boolean);
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

  // Handle escape key to close editor
  // Mark as panel so it yields to modal dialogs
  useModalEscapeKey(() => setEditorOpenMutation.mutate(false), { isPanel: true });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTaskMutation.mutate({ id: task.id, updates: { title: e.target.value } });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateTaskMutation.mutate({ id: task.id, updates: { description: e.target.value } });
  };

  const handlePriorityChange = (priority: Priority) => {
    updateTaskMutation.mutate({ id: task.id, updates: { priority } });
  };

  const handleCalendarChange = (calendarId: string) => {
    const targetCalendar = allCalendars.find(c => c.id === calendarId);
    if (targetCalendar) {
      // If this is a subtask and calendar is being changed, convert it to a regular task
      const updates: any = {
        calendarId: targetCalendar.id,
        accountId: targetCalendar.accountId,
      };

      if (task.parentUid) {
        updates.parentUid = undefined;
      }

      updateTaskMutation.mutate({ id: task.id, updates });
    }
  };

  const handleStartDateChange = (date: Date | undefined, allDay?: boolean) => {
    updateTaskMutation.mutate({ id: task.id, updates: { startDate: date, startDateAllDay: allDay } });
  };

  const handleDueDateChange = (date: Date | undefined, allDay?: boolean) => {
    updateTaskMutation.mutate({ id: task.id, updates: { dueDate: date, dueDateAllDay: allDay } });
  };

  const handleStartDateAllDayChange = (allDay: boolean) => {
    updateTaskMutation.mutate({ id: task.id, updates: { startDateAllDay: allDay } });
  };

  const handleDueDateAllDayChange = (allDay: boolean) => {
    updateTaskMutation.mutate({ id: task.id, updates: { dueDateAllDay: allDay } });
  };

  const handleAddReminder = (date: Date) => {
    addReminderMutation.mutate({ taskId: task.id, trigger: date });
  };

  const handleRemoveReminder = (reminderId: string) => {
    removeReminderMutation.mutate({ taskId: task.id, reminderId });
  };

  const handleUpdateReminder = (reminderId: string, trigger: Date) => {
    updateReminderMutation.mutate({ taskId: task.id, reminderId, trigger });
    setEditingReminderId(null);
    setEditReminderDate(undefined);
  };

  const handleStartEditReminder = (reminder: { id: string; trigger: Date }) => {
    setEditingReminderId(reminder.id);
    setEditReminderDate(new Date(reminder.trigger));
  };

  const handleCancelEditReminder = () => {
    setEditingReminderId(null);
    setEditReminderDate(undefined);
  };

  const handleAddChildTask = () => {
    if (newSubtaskTitle.trim()) {
      // create a new task with parentUid set to this task's UID
      createTaskMutation.mutate({
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
      setEditorOpenMutation.mutate(false);
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
            onClick={() => setEditorOpenMutation.mutate(false)}
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
            <button
              onClick={() => setShowStartDatePicker(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg hover:border-surface-300 dark:hover:border-surface-500 focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50 transition-colors"
            >
              <Calendar className="w-4 h-4 text-surface-400 flex-shrink-0" />
              <span className={task.startDate ? 'text-surface-700 dark:text-surface-300' : 'text-surface-400'}>
                {task.startDate 
                  ? task.startDateAllDay
                    ? format(new Date(task.startDate), 'MMM d, yyyy') + ' (All day)'
                    : format(new Date(task.startDate), 'MMM d, yyyy h:mm a')
                  : 'Set start date...'}
              </span>
            </button>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
              <Calendar className="w-4 h-4" />
              Due Date
            </label>
            <button
              onClick={() => setShowDueDatePicker(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg hover:border-surface-300 dark:hover:border-surface-500 focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50 transition-colors"
            >
              <Calendar className="w-4 h-4 text-surface-400 flex-shrink-0" />
              <span className={task.dueDate ? 'text-surface-700 dark:text-surface-300' : 'text-surface-400'}>
                {task.dueDate 
                  ? task.dueDateAllDay
                    ? format(new Date(task.dueDate), 'MMM d, yyyy') + ' (All day)'
                    : format(new Date(task.dueDate), 'MMM d, yyyy h:mm a')
                  : 'Set due date...'}
              </span>
            </button>
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
          {allCalendars.length > 0 ? (
            <>
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
              {task.parentUid && (
                <p className="mt-3 text-xs text-surface-700 dark:text-surface-200 border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 rounded-md p-2">
                  Changing the calendar will convert this subtask to a regular task.
                </p>
              )}
            </>
          ) : (
            <div 
              className="w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500 rounded-lg cursor-not-allowed"
              title="Add a CalDAV account to assign tasks to calendars"
            >
              No calendars available
            </div>
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
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded border text-xs font-medium group"
                    style={{ 
                      borderColor: tag.color,
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                    }}
                >
                  <TagIcon className="w-3 h-3" />
                  {tag.name}
                  <button
                    onClick={() => removeTagFromTaskMutation.mutate({ taskId: task.id, tagId: tag.id })}
                    className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            
            <button
              onClick={() => setShowTagPicker(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-surface-500 dark:text-surface-400 border border-dashed border-surface-300 dark:border-surface-600 rounded-full hover:border-surface-400 dark:hover:border-surface-500 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add tag
            </button>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
            <Bell className="w-4 h-4" />
            Reminders {(task.reminders?.length || 0) > 0 && `(${task.reminders?.length})`}
          </label>
          <div className="space-y-2">
            {(task.reminders || []).map((reminder) => (
              <div key={reminder.id}>
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 dark:bg-surface-700 rounded-lg group">
                  <Bell className="w-4 h-4 text-surface-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-surface-700 dark:text-surface-300">
                    {format(new Date(reminder.trigger), 'MMM d, yyyy h:mm a')}
                  </span>
                  <button
                    onClick={() => handleStartEditReminder(reminder)}
                    className="p-1 text-surface-400 hover:text-primary-500 dark:hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Edit reminder"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveReminder(reminder.id)}
                    className="p-1 text-surface-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove reminder"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            <button
              onClick={() => setShowReminderPicker(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-surface-500 dark:text-surface-400 border border-dashed border-surface-300 dark:border-surface-600 rounded-full hover:border-surface-400 dark:hover:border-surface-500 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add reminder
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-surface-600 dark:text-surface-400">
              <CheckCircle2 className="w-4 h-4" />
              Subtasks {childCount > 0 && `(${childCount})`}
            </label>
          </div>

          <div className="space-y-1">
            {childTasks.map((childTask) => (
              <SubtaskTreeItem
                key={childTask.id}
                task={childTask}
                depth={0}
                checkmarkColor={checkmarkColor}
                expandedSubtasks={expandedSubtasks}
                setExpandedSubtasks={setExpandedSubtasks}
                updateTask={(id, updates) => updateTaskMutation.mutate({ id, updates })}
                confirmAndDelete={confirmAndDelete}
                getChildTasks={taskData.getChildTasks}
                countChildren={taskData.countChildren}
              />
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
                      onClick={() => toggleSubtaskCompleteMutation.mutate({ taskId: task.id, subtaskId: subtask.id })}
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                        ${subtask.completed
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-surface-300 dark:border-surface-600 hover:border-primary-400'
                        }
                      `}
                    >
                      {subtask.completed && <Check className="w-3 h-3" style={{ color: checkmarkColor }} strokeWidth={3} />}
                    </button>
                    <input
                      type="text"
                      value={subtask.title}
                      onChange={(e) => updateSubtaskMutation.mutate({ taskId: task.id, subtaskId: subtask.id, updates: { title: e.target.value } })}
                      className={`
                        flex-1 px-2 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0
                        ${subtask.completed ? 'line-through text-surface-400' : 'text-surface-700 dark:text-surface-300'}
                      `}
                    />
                    <button
                      onClick={() => deleteSubtaskMutation.mutate({ taskId: task.id, subtaskId: subtask.id })}
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

      {/* Start Date Picker Modal */}
      {showStartDatePicker && (
        <DatePickerModal
          isOpen={showStartDatePicker}
          onClose={() => setShowStartDatePicker(false)}
          value={task.startDate ? new Date(task.startDate) : undefined}
          onChange={handleStartDateChange}
          title="Start Date"
          allDay={task.startDateAllDay}
          onAllDayChange={handleStartDateAllDayChange}
        />
      )}

      {/* Due Date Picker Modal */}
      {showDueDatePicker && (
        <DatePickerModal
          isOpen={showDueDatePicker}
          onClose={() => setShowDueDatePicker(false)}
          value={task.dueDate ? new Date(task.dueDate) : undefined}
          onChange={handleDueDateChange}
          title="Due Date"
          allDay={task.dueDateAllDay}
          onAllDayChange={handleDueDateAllDayChange}
        />
      )}

      {/* Tag Picker Modal */}
      {showTagPicker && (
        <TagPickerModal
          isOpen={showTagPicker}
          onClose={() => setShowTagPicker(false)}
          availableTags={availableTags}
          onSelectTag={(tagId) => addTagToTaskMutation.mutate({ taskId: task.id, tagId })}
          allTagsAssigned={availableTags.length === 0 && tags.length > 0}
          noTagsExist={tags.length === 0}
        />
      )}

      {/* Add Reminder Modal */}
      {showReminderPicker && (
        <ReminderPickerModal
          isOpen={showReminderPicker}
          onClose={() => setShowReminderPicker(false)}
          onSave={handleAddReminder}
          title="Add Reminder"
        />
      )}

      {/* Edit Reminder Modal */}
      {editingReminderId !== null && (
        <ReminderPickerModal
          isOpen={editingReminderId !== null}
          onClose={handleCancelEditReminder}
          value={editReminderDate}
          onSave={(date) => {
            if (editingReminderId) {
              handleUpdateReminder(editingReminderId, date);
            }
          }}
          title="Edit Reminder"
        />
      )}
    </div>
  );
}
