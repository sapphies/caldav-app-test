import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/index.css';
import { ConfirmDialogProvider } from '@/providers/ConfirmDialogProvider';
import { ModalStateProvider } from '@/providers/ModalStateProvider';
import { queryClient } from '@/lib/queryClient';
import { initializeDataStore } from '@/lib/taskData';
import { createLogger } from './lib/logger';

const log = createLogger('Bootstrap', '#a855f7');

// Initialize SQLite database, then render the app
async function bootstrap() {
  // Initialize data store (SQLite connection + initial data load)
  await initializeDataStore();
  
  // Now render the app
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ModalStateProvider>
          <ConfirmDialogProvider>
            <App />
          </ConfirmDialogProvider>
        </ModalStateProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
  
  // delay showing the window to prevent white flash on startup
  // should experiment with the exact timing here
  // 100ms seems to work ok on my macbook but i'll try it on windows and fedora later...
  setTimeout(async () => {
    (await import('@tauri-apps/api/window')).getCurrentWindow().show();
  }, 200);
}

await bootstrap().catch(error => {
  log.error('[Bootstrap] Failed to initialize app:', error);
  // Show error in the DOM for debugging
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui;">
        <h1 style="color: #dc2626;">Failed to initialize database</h1>
        <pre style="background: #fef2f2; padding: 1rem; border-radius: 0.5rem; overflow: auto;">${error}</pre>
      </div>
    `;
  }
  // Still show window so user can see the error
  import('@tauri-apps/api/window').then(m => m.getCurrentWindow().show());
});
