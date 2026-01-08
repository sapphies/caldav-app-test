import { useState, useEffect, useRef } from 'react';
import X from 'lucide-react/icons/x';
import Upload from 'lucide-react/icons/upload';
import FileText from 'lucide-react/icons/file-text';
import AlertCircle from 'lucide-react/icons/alert-circle';
import Check from 'lucide-react/icons/check';
import { useAccounts, useCreateTask } from '@/hooks/queries';
import { parseIcsFile, parseJsonTasksFile } from '../../utils/ical';
import { pluralize } from '../../utils/format';
import type { Task, Calendar } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/lib/logger';

const log = createLogger('Import', '#84cc16');

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  preloadedFile?: { name: string; content: string } | null;
}

export function ImportModal({ isOpen, onClose, preloadedFile }: ImportModalProps) {
  const { data: accounts = [] } = useAccounts();
  const createTaskMutation = useCreateTask();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [parsedTasks, setParsedTasks] = useState<Partial<Task>[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // get all calendars from accounts
  const allCalendars: Calendar[] = accounts.flatMap((account) => account.calendars);
  const hasAccounts = accounts.length > 0;

  // get available calendars for the selected account
  const availableCalendars = allCalendars.filter(
    (cal) => cal.accountId === selectedAccountId
  );

  // set default account when modal opens
  useEffect(() => {
    if (isOpen && hasAccounts && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
    if (isOpen && !hasAccounts) {
      setSelectedAccountId('');
    }
  }, [isOpen, accounts, selectedAccountId, hasAccounts]);

  // set default calendar when account changes - only if calendar doesn't belong to account
  useEffect(() => {
    if (selectedAccountId) {
      const cals = allCalendars.filter(
        (cal) => cal.accountId === selectedAccountId
      );
      // only reset calendar if current selection doesn't belong to the selected account
      const currentCalBelongsToAccount = cals.some(c => c.id === selectedCalendarId);
      if (!currentCalBelongsToAccount) {
        if (cals.length > 0) {
          setSelectedCalendarId(cals[0].id);
        } else {
          setSelectedCalendarId('');
        }
      }
    }
  }, [selectedAccountId]);

  // handle preloaded file
  useEffect(() => {
    if (isOpen && preloadedFile) {
      handleFileContent(preloadedFile.name, preloadedFile.content);
    }
  }, [isOpen, preloadedFile]);

  // handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const handleFileContent = (name: string, content: string) => {
    setFileName(name);
    setError('');
    setImportSuccess(false);

    let tasks: Partial<Task>[] = [];

    if (name.endsWith('.ics') || name.endsWith('.ical')) {
      tasks = parseIcsFile(content);
    } else if (name.endsWith('.json')) {
      tasks = parseJsonTasksFile(content);
    } else {
      // try to detect format by content
      if (content.trim().startsWith('BEGIN:VCALENDAR')) {
        tasks = parseIcsFile(content);
      } else if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
        tasks = parseJsonTasksFile(content);
      } else {
        setError('Unsupported file format. Please use .ics or .json files.');
        return;
      }
    }

    if (tasks.length === 0) {
      setError('No tasks found in the file.');
      return;
    }

    setParsedTasks(tasks);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      handleFileContent(file.name, content);
    } catch (err) {
      setError('Failed to read file.');
      log.error('Failed to read file:', err);
    }
  };

  const handleImport = async () => {
    if (!selectedCalendarId || parsedTasks.length === 0) return;

    setImporting(true);
    setError('');

    try {
      const selectedCalendar = allCalendars.find((c) => c.id === selectedCalendarId);
      if (!selectedCalendar) {
        setError('Selected calendar not found.');
        return;
      }

      // create a map of old UIDs to new UIDs for parent-child relationships
      const uidMap = new Map<string, string>();
      for (const task of parsedTasks) {
        if (task.uid) {
          const newUid = `${uuidv4()}@caldav-tasks`;
          uidMap.set(task.uid, newUid);
        }
      }

      // import tasks with new UIDs
      for (const partialTask of parsedTasks) {
        const newUid = partialTask.uid ? uidMap.get(partialTask.uid) : `${uuidv4()}@caldav-tasks`;
        const newParentUid = partialTask.parentUid ? uidMap.get(partialTask.parentUid) : undefined;

        const task: Task = {
          id: uuidv4(),
          uid: newUid || `${uuidv4()}@caldav-tasks`,
          title: partialTask.title || 'Untitled Task',
          description: partialTask.description || '',
          completed: partialTask.completed || false,
          completedAt: partialTask.completedAt,
          priority: partialTask.priority || 'none',
          categoryId: partialTask.categoryId,
          startDate: partialTask.startDate,
          dueDate: partialTask.dueDate,
          createdAt: partialTask.createdAt || new Date(),
          modifiedAt: new Date(),
          subtasks: partialTask.subtasks || [],
          parentUid: newParentUid,
          isCollapsed: partialTask.isCollapsed || false,
          sortOrder: partialTask.sortOrder || Date.now(),
          accountId: selectedAccountId,
          calendarId: selectedCalendarId,
          synced: false,
        };

        createTaskMutation.mutate(task);
      }

      setImportSuccess(true);
      setTimeout(() => {
        onClose();
        // reset state
        setParsedTasks([]);
        setFileName('');
        setImportSuccess(false);
      }, 1500);
    } catch (err) {
      setError('Failed to import tasks.');
      log.error('Failed to import tasks:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      handleFileContent(file.name, content);
    } catch (err) {
      setError('Failed to read file.');
      log.error('Failed to read dropped file:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const resetState = () => {
    setParsedTasks([]);
    setFileName('');
    setError('');
    setImportSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div 
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-lg mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">
            Import Tasks
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary dark:hover:border-primary transition-colors"
          >
            {fileName ? (
              <div className="flex items-center justify-center gap-2 text-surface-700 dark:text-surface-300">
                <FileText className="w-5 h-5" />
                <span>{fileName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetState();
                  }}
                  className="ml-2 p-1 hover:bg-surface-200 dark:hover:bg-surface-600 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-surface-400 mb-2" />
                <p className="text-surface-600 dark:text-surface-400">
                  Drop an .ics or .json file here, or click to select
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,.ical,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {parsedTasks.length > 0 && (
            <div className="bg-surface-50 dark:bg-surface-700 rounded-lg p-3">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Found {parsedTasks.length} {pluralize(parsedTasks.length, 'task')}:
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 overscroll-contain">
                {parsedTasks.slice(0, 10).map((task, i) => (
                  <div
                    key={i}
                    className="text-sm text-surface-600 dark:text-surface-400 truncate"
                  >
                    • {task.title}
                  </div>
                ))}
                {parsedTasks.length > 10 && (
                  <div className="text-sm text-surface-500">
                    ... and {parsedTasks.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={!hasAccounts}
              className={`w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${!hasAccounts ? 'cursor-not-allowed text-surface-400 dark:text-surface-500' : ''}`}
            >
              {!hasAccounts ? (
                <option value="" disabled>
                  No accounts available
                </option>
              ) : (
                accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Import to Calendar
            </label>
            <select
              value={selectedCalendarId}
              onChange={(e) => setSelectedCalendarId(e.target.value)}
              className={`w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${availableCalendars.length === 0 ? 'cursor-not-allowed text-surface-400 dark:text-surface-500' : ''}`}
              disabled={availableCalendars.length === 0}
            >
              {availableCalendars.length === 0 ? (
                <option value="">No calendars available</option>
              ) : (
                availableCalendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.displayName}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-surface-200 dark:border-surface-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={
              parsedTasks.length === 0 ||
              !selectedCalendarId ||
              importing ||
              importSuccess
            }
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {importSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Imported!
              </>
            ) : importing ? (
              'Importing...'
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import {parsedTasks.length > 0 ? `${parsedTasks.length} ${pluralize(parsedTasks.length, 'Task')}` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
