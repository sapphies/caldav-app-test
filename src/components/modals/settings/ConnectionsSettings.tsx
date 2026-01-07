import { useState } from 'react';
import ChevronDown from 'lucide-react/icons/chevron-down';
import Trash2 from 'lucide-react/icons/trash-2';
import { useDeleteAccount } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settingsStore';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { Account } from '@/types';

interface ConnectionsSettingsProps {
  accounts: Account[];
}

export function ConnectionsSettings({ accounts }: ConnectionsSettingsProps) {
  const deleteAccountMutation = useDeleteAccount();
  const { confirm } = useConfirmDialog();
  const { confirmBeforeDeleteAccount } = useSettingsStore();
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const toggleExpanded = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleDeleteAccount = async (account: { id: string; name: string }) => {
    if (confirmBeforeDeleteAccount) {
      const confirmed = await confirm({
        title: 'Remove account',
        subtitle: account.name,
        message: `Are you sure? All tasks from this account will be removed from the app. They will remain on the server.`,
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
        destructive: true,
      });
      if (!confirmed) {
        return;
      }
    }
    deleteAccountMutation.mutate(account.id);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Connections</h3>
      <div className="space-y-3 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        {accounts.length === 0 ? (
          <div className="text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">No accounts connected yet.</p>
            <p className="text-xs text-surface-400 dark:text-surface-500">Add an account from the sidebar to get started.</p>
          </div>
        ) : (
          accounts.map((account) => {
            const isExpanded = expandedAccounts.has(account.id);
            return (
              <div
                key={account.id}
                className="rounded-lg border border-surface-200 dark:border-surface-600 overflow-hidden"
              >
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                  onClick={() => toggleExpanded(account.id)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    <div>
                      <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{account.name}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{account.username} ({account.serverType})</p>
                    </div>
                  </div>

                </div>
                
                {isExpanded && (
                  <div className="border-t border-surface-200 dark:border-surface-600 p-3 bg-surface-50 dark:bg-surface-900/50 space-y-3">
                    <div>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Server</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300 font-mono break-all">{account.serverUrl}</p>
                    </div>
                    
                    {account.calendars.length > 0 && (
                      <div>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Calendars ({account.calendars.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {account.calendars.map(cal => (
                            <span key={cal.id} className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400 px-2 py-0.5 rounded">
                              {cal.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-surface-200 dark:border-surface-600">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAccount(account);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
