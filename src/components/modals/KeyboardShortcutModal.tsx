import { useState, useEffect, useRef } from 'react';
import X from 'lucide-react/icons/x';
import RotateCcw from 'lucide-react/icons/rotate-ccw';
import { type KeyboardShortcut } from '@/store/settingsStore';
import { getMetaKeyLabel, getAltKeyLabel, getShiftKeyLabel } from '../../utils/keyboard';

interface KeyboardShortcutModalProps {
  isOpen: boolean;
  shortcut: KeyboardShortcut | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<KeyboardShortcut>) => void;
}

const metaKeyLabel = getMetaKeyLabel();

export function KeyboardShortcutModal({ isOpen, shortcut, onClose, onSave }: KeyboardShortcutModalProps) {
  const [pendingShortcut, setPendingShortcut] = useState<Partial<KeyboardShortcut> | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // Reset pending shortcut when modal opens with new shortcut
  useEffect(() => {
    if (isOpen && shortcut) {
      setPendingShortcut(null);
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, shortcut?.id]);

  // Handle ESC key - need to use capture phase to intercept before useModalEscapeKey
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        if (pendingShortcut) {
          // If recording, just cancel the recording (don't close anything)
          setPendingShortcut(null);
        } else {
          // If not recording, close this modal (but not the parent Settings modal)
          onClose();
        }
      }
    };

    // Use capture phase to intercept before SettingsModal's useModalEscapeKey
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true } as EventListenerOptions);
  }, [isOpen, pendingShortcut, onClose]);

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Escape is handled by the global handler in useEffect
    if (e.key === 'Escape') {
      return;
    }

    // Ignore modifier-only keypresses
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
      return;
    }

    const newShortcut: Partial<KeyboardShortcut> = {
      key: e.key,
      meta: e.metaKey || e.ctrlKey,
      ctrl: e.ctrlKey && !e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };

    setPendingShortcut(newShortcut);
  };

  const handleSave = () => {
    if (pendingShortcut && shortcut) {
      onSave(shortcut.id, pendingShortcut);
    }
    onClose();
  };

  const handleReset = () => {
    setPendingShortcut(null);
  };

  const formatShortcut = (s: KeyboardShortcut | Partial<KeyboardShortcut>): string => {
    const parts: string[] = [];
    if (s.meta) parts.push(metaKeyLabel);
    if (s.ctrl && !s.meta) parts.push('Ctrl');
    if (s.shift) parts.push(getShiftKeyLabel());
    if (s.alt) parts.push(getAltKeyLabel());
    if (s.key) {
      const keyDisplay = s.key === ' ' ? 'Space' : 
                        s.key.length === 1 ? s.key.toUpperCase() : s.key;
      parts.push(keyDisplay);
    }
    return parts.join(' + ') || 'Press keys...';
  };

  const displayShortcut = pendingShortcut || shortcut;

  if (!isOpen || !shortcut) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-md animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
              Edit Shortcut
            </h2>
            <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
              {shortcut.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Press the key combination you want to use
            </p>
            
            <div 
              ref={inputRef}
              tabIndex={0}
              onKeyDown={handleKeyCapture}
              className="w-full h-20 flex items-center justify-center bg-surface-50 dark:bg-surface-900 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-500 focus:bg-primary-50 dark:focus:bg-primary-900/20 transition-colors cursor-text"
            >
              {displayShortcut ? (
                <div className="flex items-center gap-2">
                  {formatShortcut(displayShortcut).split(' + ').map((key, idx, arr) => (
                    <span key={idx} className="flex items-center">
                      <kbd className={`px-3 py-2 rounded-lg text-sm font-mono shadow-sm ${
                        pendingShortcut 
                          ? 'bg-primary-100 dark:bg-primary-900/50 border-2 border-primary-400 dark:border-primary-600 text-primary-700 dark:text-primary-300'
                          : 'bg-surface-100 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300'
                      }`}>
                        {key}
                      </kbd>
                      {idx < arr.length - 1 && (
                        <span className="text-surface-400 mx-1 text-lg">+</span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-surface-400 dark:text-surface-500 text-sm">
                  Click here and press keys...
                </span>
              )}
            </div>

            {pendingShortcut && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to original
              </button>
            )}
          </div>

          <div className="text-xs text-surface-500 dark:text-surface-400 text-center">
            <p>Press <kbd className="px-1.5 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-surface-600 dark:text-surface-400">Esc</kbd> to cancel recording</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-surface-200 dark:border-surface-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!pendingShortcut}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors ${
              pendingShortcut
                ? 'bg-primary-600 hover:bg-primary-700'
                : 'bg-surface-300 dark:bg-surface-600 cursor-not-allowed'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
