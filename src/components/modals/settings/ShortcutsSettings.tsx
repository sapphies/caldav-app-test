import { useState } from 'react';
import RotateCcw from 'lucide-react/icons/rotate-ccw';
import Pencil from 'lucide-react/icons/pencil';
import { useSettingsStore, type KeyboardShortcut } from '@/store/settingsStore';
import { getMetaKeyLabel, getAltKeyLabel, getShiftKeyLabel } from '@/utils/keyboard';
import { KeyboardShortcutModal } from '../KeyboardShortcutModal';

const metaKeyLabel = getMetaKeyLabel();

export function ShortcutsSettings() {
  const { keyboardShortcuts, updateShortcut, resetShortcuts } = useSettingsStore();
  const [editingShortcut, setEditingShortcut] = useState<KeyboardShortcut | null>(null);

  const formatShortcut = (shortcut: KeyboardShortcut | Partial<KeyboardShortcut>): string => {
    const parts: string[] = [];
    if (shortcut.meta) parts.push(metaKeyLabel);
    if (shortcut.ctrl && !shortcut.meta) parts.push('Ctrl');
    if (shortcut.shift) parts.push(getShiftKeyLabel());
    if (shortcut.alt) parts.push(getAltKeyLabel());
    if (shortcut.key) {
      const keyDisplay = shortcut.key === ' ' ? 'Space' : 
                        shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
      parts.push(keyDisplay);
    }
    return parts.join(' + ') || 'Press keys...';
  };

  const handleSave = (id: string, updates: Partial<KeyboardShortcut>) => {
    updateShortcut(id, updates);
    setEditingShortcut(null);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-row justify-between">
          <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Keyboard Shortcuts</h3>
          <button
            onClick={resetShortcuts}
            className="flex items-center gap-1 px-2 py-1 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Defaults
          </button>
        </div>
        
        <div className="space-y-1 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
          {keyboardShortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between py-2.5 px-3 bg-white dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700 last:border-0"
            >
              <span className="text-sm text-surface-600 dark:text-surface-400">{shortcut.description}</span>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {formatShortcut(shortcut).split(' + ').map((key, keyIndex, arr) => (
                    <span key={keyIndex} className="flex items-center">
                      <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded text-xs font-mono text-surface-700 dark:text-surface-300">
                        {key}
                      </kbd>
                      {keyIndex < arr.length - 1 && (
                        <span className="text-surface-400 mx-0.5">+</span>
                      )}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setEditingShortcut(shortcut)}
                  className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors"
                  title="Edit shortcut"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <KeyboardShortcutModal
        isOpen={editingShortcut !== null}
        shortcut={editingShortcut}
        onClose={() => setEditingShortcut(null)}
        onSave={handleSave}
      />
    </>
  );
}
