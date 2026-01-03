import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { ConfirmDialogProvider } from '@/providers/ConfirmDialogProvider';
import { ModalStateProvider } from '@/providers/ModalStateProvider';

// delay showing the window to prevent white flash on startup
// should experiment with the exact timing here
// 100ms seems to work ok on my macbook but i'll try it on windows and fedora later...
setTimeout(async () => {
  (await import('@tauri-apps/api/window')).getCurrentWindow().show();
}, 100);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ModalStateProvider>
      <ConfirmDialogProvider>
        <App />
      </ConfirmDialogProvider>
    </ModalStateProvider>
  </React.StrictMode>
);
