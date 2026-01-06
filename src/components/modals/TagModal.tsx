import { useState, useRef, useEffect } from 'react';
import X from 'lucide-react/icons/x';
import { useTags, useCreateTag, useUpdateTag } from '@/hooks/queries';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import { IconPicker, getIconByName } from '../IconPicker';
import { COLOR_PRESETS, DEFAULT_COLOR } from '@/utils/constants';

interface TagModalProps {
  tagId: string | null;
  onClose: () => void;
}

export function TagModal({ tagId, onClose }: TagModalProps) {
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();
  const updateTagMutation = useUpdateTag();
  
  const existingTag = tagId 
    ? tags.find((t) => t.id === tagId) 
    : null;

  const [name, setName] = useState(existingTag?.name || '');
  const [color, setColor] = useState(existingTag?.color || DEFAULT_COLOR);
  const [icon, setIcon] = useState(existingTag?.icon || 'star');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // handle ESC key to close modal
  useModalEscapeKey(onClose);

  // Autofocus name input after modal is mounted and visible
  useEffect(() => {
    // Delay to ensure modal animation (150ms) has completed
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (existingTag) {
      updateTagMutation.mutate({ id: existingTag.id, updates: { name, color, icon } });
    } else {
      createTagMutation.mutate({ name, color, icon });
    }

    onClose();
  };

  const IconComponent = getIconByName(icon);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div 
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">
            {existingTag ? 'Edit Tag' : 'New Tag'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Tag Name
            </label>
            <div className="flex items-center gap-2">
              <IconPicker value={icon} onChange={setIcon} color={color} />
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tag name"
                required
                className="flex-1 px-3 py-2 text-sm text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`
                    w-8 h-8 rounded-full transition-all
                    ${color === preset ? 'ring-2 ring-offset-2 dark:ring-offset-surface-800 ring-primary-500 scale-110' : 'hover:scale-110'}
                  `}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1 px-3 py-1.5 text-sm font-mono text-surface-800 dark:text-surface-200 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg focus:outline-none focus:border-primary-300"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              Preview
            </label>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              <IconComponent className="w-3.5 h-3.5" />
              {name || 'Tag name'}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              {existingTag ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
