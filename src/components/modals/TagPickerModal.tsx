import X from 'lucide-react/icons/x';
import { useModalEscapeKey } from '@/hooks/useModalEscapeKey';
import type { Tag } from '@/types';
import { getIconByName } from '../IconPicker';

interface TagPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTags: Tag[];
  onSelectTag: (tagId: string) => void;
  allTagsAssigned: boolean;
  noTagsExist: boolean;
}

export function TagPickerModal({
  isOpen,
  onClose,
  availableTags,
  onSelectTag,
  allTagsAssigned,
  noTagsExist,
}: TagPickerModalProps) {
  // Handle ESC key to close modal
  useModalEscapeKey(onClose);

  if (!isOpen) return null;

  const handleSelectTag = (tagId: string) => {
    onSelectTag(tagId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div
        className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-xs animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-800 dark:text-surface-200">Add Tag</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto">
          {noTagsExist ? (
            <div className="p-4 text-center text-sm text-surface-500 dark:text-surface-400">
              No tags created yet. Create a tag from the sidebar first.
            </div>
          ) : allTagsAssigned ? (
            <div className="p-4 text-center text-sm text-surface-500 dark:text-surface-400">
              All available tags have been assigned to this task.
            </div>
          ) : (
            <div className="space-y-1">
              {availableTags.map((tag) => {
                const TagIcon = getIconByName(tag.icon || 'tag');
                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => handleSelectTag(tag.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                  >
                    <TagIcon className="w-4 h-4" style={{ color: tag.color }} />
                    <span className="text-surface-700 dark:text-surface-300">{tag.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
