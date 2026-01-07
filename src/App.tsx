import { useState, useCallback, useEffect } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAccounts, useSyncQuery } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useTasks, useUIState } from '@/hooks/queries';
import { Sidebar } from '@/components/Sidebar';
import { TaskList } from '@/components/TaskList';
import { TaskEditor } from '@/components/TaskEditor';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ImportModal } from '@/components/modals/ImportModal';
import { initWebKitDragFix } from './utils/webkit';

function App() {
  // Initialize WebKit drag-and-drop fix for Safari/Tauri
  useEffect(() => {
    initWebKitDragFix();
  }, []);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [preloadedFile, setPreloadedFile] = useState<{ name: string; content: string } | null>(null);
  const { isSyncing, isOffline, lastSyncTime, syncAll } = useSyncQuery();
  
  // File drop handling via hook
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
      setShowImport(true);
    },
  });
  
  useTheme();

  useNotifications();
  
  useKeyboardShortcuts({
    onOpenSettings: () => setShowSettings(prev => !prev),
    onSync: syncAll,
  });
  
  const { data: uiState } = useUIState();
  const { data: accounts = [] } = useAccounts();
  const { data: tasks = [] } = useTasks();
  const isEditorOpen = uiState?.isEditorOpen ?? false;
  const selectedTaskId = uiState?.selectedTaskId ?? null;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // reset preloaded file when import modal closes
  const handleImportClose = useCallback(() => {
    setShowImport(false);
    setPreloadedFile(null);
  }, []);

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
        <div className={`pointer-events-none fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm ${
          isUnsupportedFile 
            ? 'bg-red-600/10' 
            : 'bg-primary-600/10'
        }`}>
          <div className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg border ${
            isUnsupportedFile
              ? 'bg-red-50/90 dark:bg-red-900/90 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
              : 'bg-white/90 dark:bg-surface-800/90 text-surface-800 dark:text-surface-200 border-primary-200 dark:border-primary-800'
          }`}>
            {isUnsupportedFile 
              ? 'Unsupported file format. Only .ics and .json files are supported.'
              : 'Drop .ics or .json files anywhere to import tasks'
            }
          </div>
        </div>
      )}

      <Sidebar 
        onOpenSettings={() => setShowSettings(true)} 
        onOpenImport={() => setShowImport(true)}
      />

      <main className="flex-1 flex flex-col min-w-0">
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
          <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isEditorOpen && selectedTask ? 'hidden lg:flex' : ''}`}>
            <TaskList />
          </div>

          {isEditorOpen && selectedTask && (
            <div className="w-full lg:w-[400px] flex-shrink-0 border-l border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
              <TaskEditor task={selectedTask} />
            </div>
          )}
        </div>
      </main>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      <ImportModal
        isOpen={showImport}
        onClose={handleImportClose}
        preloadedFile={preloadedFile}
      />
    </div>
  );
}

export default App;
