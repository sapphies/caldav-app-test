import { useEffect } from 'react';
import X from 'lucide-react/icons/x';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  alternateLabel?: string;
  alternateDestructive?: boolean;
  onConfirm: () => void;
  onAlternate?: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  alternateLabel,
  alternateDestructive = false,
  onConfirm,
  onAlternate,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      }
      if (e.key === 'Enter') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const getButtonClasses = (isDestructive: boolean, isPrimary: boolean) => {
    if (isDestructive) {
      return 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/50 text-white';
    }
    if (isPrimary) {
      return 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 text-white';
    }
    return 'border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-surface-200 dark:border-surface-700 rounded-t-xl">
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-surface-900 dark:text-surface-100">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="text-sm text-surface-600 dark:text-surface-400 mt-1">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            {cancelLabel}
          </button>
          {alternateLabel && onAlternate && (
            <button
              onClick={onAlternate}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${getButtonClasses(alternateDestructive, !alternateDestructive && !destructive)}`}
            >
              {alternateLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${getButtonClasses(destructive, !alternateLabel)}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
