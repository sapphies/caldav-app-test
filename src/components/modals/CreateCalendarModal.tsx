import { useState } from 'react';
import X from 'lucide-react/icons/x';
import Loader2 from 'lucide-react/icons/loader-2';
import { useAddCalendar } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settingsStore';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import { caldavService } from '@/lib/caldav';
import { IconPicker } from '../IconPicker';

interface CreateCalendarModalProps {
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

export function CreateCalendarModal({ accountId, onClose }: CreateCalendarModalProps) {
  const addCalendarMutation = useAddCalendar();
  const { accentColor } = useSettingsStore();

  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState(accentColor);
  const [icon, setIcon] = useState('calendar');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // handle ESC key to close modal
  useModalEscapeKey(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // create calendar on server
      const calendar = await caldavService.createCalendar(accountId, displayName, color);
      
      // add to local store with icon
      addCalendarMutation.mutate({ accountId, calendarData: { ...calendar, icon } });
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create calendar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div 
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">
            New Calendar
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
                placeholder="My Tasks"
                required
                autoFocus
                className="flex-1 px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`
                    w-8 h-8 rounded-full transition-all
                    ${color === preset ? 'ring-2 ring-offset-2 dark:ring-offset-surface-800 ring-primary-500 scale-110' : 'hover:scale-110'}
                  `}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1 px-3 py-1.5 text-sm font-mono text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300"
              />
            </div>
          </div>

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
              disabled={isLoading || !displayName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Calendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
