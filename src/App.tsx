import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { AccountModal } from '@/components/modals/AccountModal';
import { CreateCalendarModal } from '@/components/modals/CreateCalendarModal';
import { ExportModal } from '@/components/modals/ExportModal';
import { ImportModal } from '@/components/modals/ImportModal';
import { OnboardingModal } from '@/components/modals/OnboardingModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { Sidebar } from '@/components/Sidebar';
import { TaskEditor } from '@/components/TaskEditor';
import { TaskList } from '@/components/TaskList';
import { UpdateBanner } from '@/components/UpdateBanner';
import { useAccounts, useSyncQuery, useTasks, useUIState } from '@/hooks/queries';
import { useAppMenu } from '@/hooks/useAppMenu';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMenuHandlers } from '@/hooks/useMenuHandlers';
import { useNotifications } from '@/hooks/useNotifications';
import { useTheme } from '@/hooks/useTheme';
import { useTray } from '@/hooks/useTray';
import { useUpdateChecker } from '@/hooks/useUpdateChecker';
import { useSettingsStore } from '@/store/settingsStore';
import { initWebKitDragFix } from './utils/webkit';

function App() {
  // Initialize WebKit drag-and-drop fix for Safari/Tauri
  useEffect(() => {
    initWebKitDragFix();
  }, []);

  const [preloadedFile, setPreloadedFile] = useState<{ name: string; content: string } | null>(
    null,
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isSyncing, isOffline, lastSyncTime, syncAll } = useSyncQuery();
  const { data: accounts = [] } = useAccounts();
  const {
    sidebarCollapsed,
    sidebarWidth,
    toggleSidebarCollapsed,
    setSidebarWidth,
    onboardingCompleted,
  } = useSettingsStore();

  // show onboarding modal on first launch
  useEffect(() => {
    if (!onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, [onboardingCompleted]);

  // system tray integration (sync button, status updates)
  useTray({
    isSyncing,
    lastSyncTime,
    onSyncRequest: syncAll,
  });

  // app update checker
  const { updateAvailable, downloadAndInstall, dismissUpdate, isDownloading, downloadProgress } =
    useUpdateChecker();

  // app menu state synchronization
  useAppMenu();

  // menu handlers and modal state
  const menuHandlers = useMenuHandlers();

  // file drop handling via hook
  const {
    isDragOver,
    isUnsupportedFile,
    handleFileDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
  } = useFileDrop({
    onFileDrop: (file) => {
      setPreloadedFile(file);
      menuHandlers.setShowImport(true);
    },
  });

  useTheme();
  useNotifications();

  useKeyboardShortcuts({
    onOpenSettings: () => {
      menuHandlers.setSettingsInitialTab({});
      menuHandlers.setShowSettings((prev: boolean) => !prev);
    },
    onSync: syncAll,
  });

  const { data: uiState } = useUIState();
  const { data: tasks = [] } = useTasks();
  const isEditorOpen = uiState?.isEditorOpen ?? false;
  const selectedTaskId = uiState?.selectedTaskId ?? null;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // reset preloaded file when import modal closes
  const handleImportClose = useCallback(() => {
    menuHandlers.setShowImport(false);
    setPreloadedFile(null);
  }, [menuHandlers]);

  // disable default browser context menu globally
  const handleContextMenu = (e: React.MouseEvent) => {
    // allow custom context menus to work by checking if event was already handled
    if (!(e.target as HTMLElement).closest('[data-context-menu]')) {
      e.preventDefault();
    }
  };

  return (
    <div
      className="flex h-screen bg-surface-50 dark:bg-surface-900 overflow-hidden"
      onContextMenu={handleContextMenu}
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div
          className={`pointer-events-none fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm ${
            isUnsupportedFile ? 'bg-red-600/10' : 'bg-primary-600/10'
          }`}
        >
          <div
            className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg border ${
              isUnsupportedFile
                ? 'bg-red-50/90 dark:bg-red-900/90 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
                : 'bg-white/90 dark:bg-surface-800/90 text-surface-800 dark:text-surface-200 border-primary-200 dark:border-primary-800'
            }`}
          >
            {isUnsupportedFile
              ? 'Unsupported file format. Only .ics and .json files are supported.'
              : 'Drop .ics or .json files anywhere to import tasks'}
          </div>
        </div>
      )}

      <Sidebar
        onOpenSettings={menuHandlers.handleOpenSettings}
        onOpenImport={() => menuHandlers.setShowImport(true)}
        isCollapsed={sidebarCollapsed}
        width={sidebarWidth}
        onToggleCollapse={toggleSidebarCollapsed}
        onWidthChange={setSidebarWidth}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {updateAvailable && (
          <UpdateBanner
            updateInfo={updateAvailable}
            onDownload={downloadAndInstall}
            onDismiss={dismissUpdate}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
          />
        )}

        {isOffline && (
          <div className="bg-amber-500 text-white text-center py-1 text-sm font-medium">
            You're offline. Changes will sync when you reconnect.
          </div>
        )}

        <Header
          isSyncing={isSyncing}
          onSync={syncAll}
          disableSync={accounts.length === 0}
          isOffline={isOffline}
          lastSyncTime={lastSyncTime}
        />

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div
            className={`flex-1 flex flex-col min-w-0 min-h-0 ${isEditorOpen && selectedTask ? 'hidden lg:flex' : ''}`}
          >
            <TaskList />
          </div>

          {isEditorOpen && selectedTask && (
            <div className="w-full lg:w-[400px] flex-shrink-0 border-l border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
              <TaskEditor task={selectedTask} />
            </div>
          )}
        </div>
      </main>

      {menuHandlers.showSettings && (
        <SettingsModal
          onClose={() => {
            menuHandlers.setShowSettings(false);
            menuHandlers.setSettingsInitialTab({});
          }}
          initialCategory={
            menuHandlers.settingsInitialTab.category as 'general' | 'account' | 'about' | undefined
          }
          initialSubtab={menuHandlers.settingsInitialTab.subtab as any}
        />
      )}

      <ImportModal
        isOpen={menuHandlers.showImport}
        onClose={handleImportClose}
        preloadedFile={preloadedFile}
      />

      {menuHandlers.showExport && (
        <ExportModal tasks={tasks} type="tasks" onClose={() => menuHandlers.setShowExport(false)} />
      )}

      {menuHandlers.showAccountModal && (
        <AccountModal account={null} onClose={() => menuHandlers.setShowAccountModal(false)} />
      )}

      {menuHandlers.showCreateCalendar && accounts.length > 0 && (
        <CreateCalendarModal
          accountId={accounts[0].id}
          onClose={() => menuHandlers.setShowCreateCalendar(false)}
        />
      )}

      {menuHandlers.showCreateCalendar &&
        accounts.length === 0 &&
        (() => {
          menuHandlers.setShowCreateCalendar(false);
          return null;
        })()}

      {showOnboarding && (
        <OnboardingModal
          onComplete={() => setShowOnboarding(false)}
          onAddAccount={() => {
            menuHandlers.setShowAccountModal(true);
          }}
        />
      )}
    </div>
  );
}

export default App;
