import { ReactNode } from 'react';
import X from 'lucide-react/icons/x';

interface ModalWrapperProps {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function ModalWrapper({
  isOpen = true,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalWrapperProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`bg-white dark:bg-surface-800 rounded-xl shadow-xl ${sizeClasses[size]} w-full max-h-[90vh] flex flex-col animate-scale-in`}>
        <div className="bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 p-6 flex-shrink-0 flex items-start justify-between rounded-t-xl">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {children}
        </div>

        {footer && (
          <div className="border-t border-surface-200 dark:border-surface-700 p-6 flex gap-3 flex-shrink-0 bg-white dark:bg-surface-800 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
