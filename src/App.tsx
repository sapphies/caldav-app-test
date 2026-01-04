import { useState, useCallback, useEffect } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSyncQuery } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks, useUIState } from '@/hooks/queries';
import { Sidebar } from '@/components/Sidebar';
import { TaskList } from '@/components/TaskList';
import { TaskEditor } from '@/components/TaskEditor';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ImportModal } from '@/components/modals/ImportModal';
import { initWebKitDragFix } from './utils/webkit';

// Supported file extensions for import
const SUPPORTED_EXTENSIONS = ['.ics', '.ical', '.json'];

function isSupportedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function App() {
  // Initialize WebKit drag-and-drop fix for Safari/Tauri
  useEffect(() => {
    initWebKitDragFix();
  }, []);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [preloadedFile, setPreloadedFile] = useState<{ name: string; content: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUnsupportedFile, setIsUnsupportedFile] = useState(false);
  const { isSyncing, isOffline, lastSyncTime, syncAll } = useSyncQuery();
  
  useTheme();

  useNotifications();
  
  useKeyboardShortcuts({
    onOpenSettings: () => setShowSettings(prev => !prev),
    onSync: syncAll,
  });
  
  const { data: uiState } = useUIState();
  const { data: tasks = [] } = useTasks();
  const isEditorOpen = uiState?.isEditorOpen ?? false;
  const selectedTaskId = uiState?.selectedTaskId ?? null;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Check if dragged files are supported
  const checkDraggedFiles = useCallback((e: React.DragEvent): boolean => {
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return true; // Default to supported if we can't check

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        // Try to get filename from type or check DataTransferItemList
        const file = item.getAsFile?.();
        if (file && !isSupportedFile(file.name)) {
          return false;
        }
      }
    }
    return true;
  }, []);

  // handle file drop for import
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setIsUnsupportedFile(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    // Check if it's a supported file type
    if (!isSupportedFile(file.name)) {
      // Unsupported file - don't do anything (already showed feedback during drag)
      return;
    }

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

    // Check if files are supported and update visual feedback
    const isSupported = checkDraggedFiles(e);
    setIsUnsupportedFile(!isSupported);
    
    // Set the dropEffect to show appropriate cursor
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = isSupported ? 'copy' : 'none';
    }

    setIsDragOver(true);
  }, [checkDraggedFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isSupported = checkDraggedFiles(e);
    setIsUnsupportedFile(!isSupported);

    setIsDragOver(true);
  }, [checkDraggedFiles]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setIsUnsupportedFile(false);
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
