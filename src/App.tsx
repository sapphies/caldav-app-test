import { useState, useCallback, useEffect } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSync } from '@/hooks/useSync';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { useTaskStore } from '@/store/taskStore';
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
  const [isDragOver, setIsDragOver] = useState(false);
  const { isSyncing, isOffline, lastSyncTime, syncAll } = useSync();
  
  useTheme();

  useNotifications();
  
  useKeyboardShortcuts({
    onOpenSettings: () => setShowSettings(true),
    onSync: syncAll,
  });
  
  const { isEditorOpen, selectedTaskId, tasks } = useTaskStore();
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // handle file drop for import
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    // check if it's a calendar or task file
    const isIcs = file.name.endsWith('.ics') || file.name.endsWith('.ical');
    const isJson = file.name.endsWith('.json');

    if (isIcs || isJson) {
      try {
        const content = await file.text();
        // check if JSON is a tasks file (not settings)
        if (isJson) {
          try {
            const parsed = JSON.parse(content);
            // check if it looks like a tasks export (array with task properties)
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
              setPreloadedFile({ name: file.name, content });
              setShowImport(true);
            }
          } catch {
            // not valid JSON, ignore
          }
        } else {
          setPreloadedFile({ name: file.name, content });
          setShowImport(true);
        }
      } catch (err) {
        console.error('Failed to read dropped file:', err);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

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
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-primary-600/10 backdrop-blur-sm">
          <div className="px-4 py-3 rounded-lg bg-white/90 dark:bg-surface-800/90 text-sm font-medium text-surface-800 dark:text-surface-200 shadow-lg border border-primary-200 dark:border-primary-800">
            Drop .ics or .json files anywhere to import tasks
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

        <Header isSyncing={isSyncing} onSync={syncAll} isOffline={isOffline} lastSyncTime={lastSyncTime} />

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
