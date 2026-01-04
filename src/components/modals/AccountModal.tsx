import { useState } from 'react';
import X from 'lucide-react/icons/x';
import Loader2 from 'lucide-react/icons/loader-2';
import { useCreateAccount, useUpdateAccount, useAddCalendar } from '@/hooks/queries';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import { Account, ServerType } from '@/types';
import { caldavService } from '@/lib/caldav';

interface AccountModalProps {
  account: Account | null;
  onClose: () => void;
}

export function AccountModal({ account, onClose }: AccountModalProps) {
  const createAccountMutation = useCreateAccount();
  const updateAccountMutation = useUpdateAccount();
  const addCalendarMutation = useAddCalendar();

  const [name, setName] = useState(account?.name || '');
  const [serverUrl, setServerUrl] = useState(account?.serverUrl || '');
  const [username, setUsername] = useState(account?.username || '');
  const [password, setPassword] = useState('');
  const [serverType, setServerType] = useState<ServerType>(account?.serverType ?? 'generic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // handle ESC key to close modal
  useModalEscapeKey(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const effectivePassword = password || account?.password;
      
      if (account) {
        // update existing account
        if (effectivePassword) {
          // test connection with new credentials before saving
          console.log(`[Account] Testing connection to ${serverUrl}...`);
          await caldavService.connect(account.id, serverUrl, username, effectivePassword, serverType);
        }
        
        updateAccountMutation.mutate({ id: account.id, updates: { 
          name, 
          serverUrl, 
          username,
          password: effectivePassword || account.password,
          serverType,
        } });
      } else {
        // for new accounts, first test connection before adding to store
        if (!effectivePassword) {
          throw new Error('Password is required');
        }
        
        // create a temporary ID to test the connection
        const tempId = crypto.randomUUID();
        
        console.log(`[Account] Connecting to ${serverUrl}...`);
        await caldavService.connect(tempId, serverUrl, username, effectivePassword, serverType);

        console.log(`[Account] Fetching calendars...`);
        const calendars = await caldavService.fetchCalendars(tempId);
        console.log(`[Account] Found ${calendars.length} calendars:`, calendars);
        
        // connection successful - now add the account with the same ID we used for connection
        createAccountMutation.mutate({ 
          id: tempId,  // use the same ID so the caldavService connection maps correctly
          name, 
          serverUrl, 
          username, 
          password: effectivePassword,
          serverType,
        }, {
          onSuccess: (newAccount) => {
            // add the fetched calendars
            for (const calendar of calendars) {
              addCalendarMutation.mutate({ accountId: newAccount.id, calendarData: calendar });
            }
          }
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to CalDAV server');
      console.error(err);
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
            {account ? 'Edit Account' : 'Add CalDAV Account'}
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
              Account Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My CalDAV Account"
              required
              className="w-full px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Server Type
            </label>
            <select
              value={serverType}
              onChange={(e) => setServerType(e.target.value as ServerType)}
              className="w-full px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
            >
              <option value="generic">Generic (auto-detect)</option>
              <option value="rustical">RustiCal</option>
              <option value="radicale">Radicale</option>
              <option value="baikal">Baikal</option>
            </select>
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
              {serverType === 'rustical' && 'Uses /caldav/principal/{username}/ path structure'}
              {serverType === 'radicale' && 'Uses /{username}/ path structure'}
              {serverType === 'baikal' && 'Uses /dav.php/principals/{username}/ path structure'}
              {serverType === 'generic' && 'Auto-detects using .well-known/caldav'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://caldav.example.com"
              required
              className="w-full px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
            />
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
              Enter your server URL, e.g. https://caldav.example.com
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={account ? '(unchanged)' : 'Enter password'}
              required={!account}
              className="w-full px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
            />
            <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
              Your password is stored securely on your device.
            </p>
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
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {account ? 'Save' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
