import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { ConfirmDialogProvider } from '@/providers/ConfirmDialogProvider';
import { ModalStateProvider } from '@/providers/ModalStateProvider';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ModalStateProvider>
      <ConfirmDialogProvider>
        <App />
      </ConfirmDialogProvider>
    </ModalStateProvider>
  </React.StrictMode>
);
