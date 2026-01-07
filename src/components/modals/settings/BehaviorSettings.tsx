import { useAccounts } from '@/hooks/queries';
import { useSettingsStore, type StartOfWeek, type SubtaskDeletionBehavior } from '@/store/settingsStore';

export function BehaviorSettings() {
  const { 
    confirmBeforeDelete,
    setConfirmBeforeDelete,
    confirmBeforeDeleteCalendar,
    setConfirmBeforeDeleteCalendar,
    confirmBeforeDeleteAccount,
    setConfirmBeforeDeleteAccount,
    confirmBeforeDeleteTag,
    setConfirmBeforeDeleteTag,
    deleteSubtasksWithParent,
    setDeleteSubtasksWithParent,
    startOfWeek,
    setStartOfWeek,
    defaultCalendarId,
    setDefaultCalendarId,
  } = useSettingsStore();
  const { data: accounts = [] } = useAccounts();
  
  // Get all calendars from all accounts
  const allCalendars = accounts.flatMap(account => 
    account.calendars.map(cal => ({
      ...cal,
      accountName: account.name,
    }))
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Behavior</h3>
      <div className="space-y-4 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <label className="flex items-center justify-between">
          <span className="text-sm text-surface-600 dark:text-surface-400">Confirm before deleting tasks</span>
          <input 
            type="checkbox" 
            checked={confirmBeforeDelete}
            onChange={(e) => setConfirmBeforeDelete(e.target.checked)}
            className="rounded border-surface-300" 
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-surface-600 dark:text-surface-400">Confirm before deleting calendars</span>
          <input 
            type="checkbox" 
            checked={confirmBeforeDeleteCalendar}
            onChange={(e) => setConfirmBeforeDeleteCalendar(e.target.checked)}
            className="rounded border-surface-300" 
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-surface-600 dark:text-surface-400">Confirm before deleting accounts</span>
          <input 
            type="checkbox" 
            checked={confirmBeforeDeleteAccount}
            onChange={(e) => setConfirmBeforeDeleteAccount(e.target.checked)}
            className="rounded border-surface-300" 
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-surface-600 dark:text-surface-400">Confirm before deleting tags</span>
          <input 
            type="checkbox" 
            checked={confirmBeforeDeleteTag}
            onChange={(e) => setConfirmBeforeDeleteTag(e.target.checked)}
            className="rounded border-surface-300" 
          />
        </label>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-700 dark:text-surface-300">When deleting a task with subtasks</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">Choose what happens to subtasks</p>
          </div>
          <select
            value={deleteSubtasksWithParent}
            onChange={(e) => setDeleteSubtasksWithParent(e.target.value as SubtaskDeletionBehavior)}
            className="px-3 py-1.5 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300"
          >
            <option value="delete">Delete all subtasks</option>
            <option value="keep">Keep subtasks</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-700 dark:text-surface-300">Week starts on</p>
            <p className="text-xs text-surface-500 dark:text-surface-400">Choose how dates are shown in calendars</p>
          </div>
          <select
            value={startOfWeek}
            onChange={(e) => setStartOfWeek(e.target.value as StartOfWeek)}
            className="px-3 py-1.5 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300"
          >
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </div>

        {allCalendars.length > 0 && (
          <div>
            <div className="mb-2">
              <p className="text-sm text-surface-700 dark:text-surface-300">Default calendar for new tasks</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Used when creating tasks from "All Tasks" view</p>
            </div>
            <select
              value={defaultCalendarId || ''}
              onChange={(e) => setDefaultCalendarId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 rounded-lg focus:outline-none focus:border-primary-300"
            >
              <option value="">Use active calendar</option>
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
          </div>
        )}
      </div>
    </div>
  );
}
