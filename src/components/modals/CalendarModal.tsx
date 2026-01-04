import { useState, useEffect } from 'react';
import X from 'lucide-react/icons/x';
import Loader2 from 'lucide-react/icons/loader-2';
import { useAccounts, useUpdateAccount } from '@/hooks/queries';
import { Calendar } from '@/types';
import { caldavService } from '@/lib/caldav';
import { IconPicker } from '../IconPicker';

interface CalendarModalProps {
  calendar: Calendar;
  accountId: string;
  onClose: () => void;
}

const colorPresets = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

export function CalendarModal({ calendar, accountId, onClose }: CalendarModalProps) {
  const { data: accounts = [] } = useAccounts();
  const updateAccountMutation = useUpdateAccount();

  const [displayName, setDisplayName] = useState(calendar.displayName);
  const [color, setColor] = useState(calendar.color || '#3b82f6');
  const [icon, setIcon] = useState(calendar.icon || 'calendar');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  // handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // only send properties that have actually changed (to server)
      const serverUpdates: { displayName?: string; color?: string } = {};
      
      if (displayName !== calendar.displayName) {
        serverUpdates.displayName = displayName;
      }
      
      if (color !== calendar.color) {
        serverUpdates.color = color;
      }

      // track local-only changes (icon is stored locally only)
      const iconChanged = icon !== calendar.icon;

      // if nothing changed at all, just close the modal
      if (Object.keys(serverUpdates).length === 0 && !iconChanged) {
        onClose();
        return;
      }

      let result = { failedProperties: [] as string[] };
      
      // only call server if server properties changed
      if (Object.keys(serverUpdates).length > 0) {
        // update calendar on server via PROPPATCH
        result = await caldavService.updateCalendar(accountId, calendar.url, serverUpdates);
      }

      // update local state (only update what succeeded + local-only fields)
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        const updatedCalendars = account.calendars.map(c => {
          if (c.id === calendar.id) {
            const updates: Partial<Calendar> = {};
            // only update displayName locally if server accepted it
            if (!result.failedProperties.includes('displayname')) {
              updates.displayName = displayName;
            }
            // only update color locally if server accepted it
            if (!result.failedProperties.includes('calendar-color')) {
              updates.color = color;
            }
            // icon is always updated locally (not stored on server)
            updates.icon = icon;
            return { ...c, ...updates };
          }
          return c;
        });
        updateAccountMutation.mutate({ id: accountId, updates: { calendars: updatedCalendars } });
      }

      // show warning if some properties failed
      if (result.failedProperties.length > 0) {
        const failedNames = result.failedProperties.map(p => 
          p === 'displayname' ? 'calendar name' : 'color'
        ).join(' and ');
        setWarning(`Server doesn't support updating ${failedNames}. Other changes were saved.`);
        return; // don't close modal so user can see the warning
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update calendar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div 
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">
            Edit Calendar
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Calendar Name
            </label>
            <div className="flex items-center gap-2">
              <IconPicker value={icon} onChange={setIcon} color={color} />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Calendar"
                required
                className="flex-1 px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {colorPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === preset
                      ? 'border-surface-800 dark:border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>

          {warning && (
            <div className="p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              {warning}
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
