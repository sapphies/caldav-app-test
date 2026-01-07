import { useTags } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settingsStore';
import { getIconByName } from '@/components/IconPicker';
import type { Priority } from '@/types';

export function TaskDefaultsSettings() {
  const { 
    defaultPriority,
    setDefaultPriority,
    defaultTags,
    setDefaultTags,
  } = useSettingsStore();
  const { data: tags = [] } = useTags();

  const priorities: { value: Priority; label: string; color: string; borderColor: string; bgColor: string }[] = [
    { value: 'high', label: 'High', color: 'text-red-500', borderColor: 'border-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30' },
    { value: 'medium', label: 'Medium', color: 'text-amber-500', borderColor: 'border-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
    { value: 'low', label: 'Low', color: 'text-blue-500', borderColor: 'border-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
    { value: 'none', label: 'None', color: 'text-surface-400', borderColor: 'border-surface-300', bgColor: 'bg-surface-50 dark:bg-surface-700' },
  ];

  const handleTagToggle = (tagId: string) => {
    if (defaultTags.includes(tagId)) {
      setDefaultTags(defaultTags.filter(id => id !== tagId));
    } else {
      setDefaultTags([...defaultTags, tagId]);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Task Defaults</h3>
      <div className="rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Default Priority</h4>
        <div className="flex gap-2">
          {priorities.map((p) => (
            <button
              key={p.value}
              onClick={() => setDefaultPriority(p.value)}
              className={`
                flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                ${defaultPriority === p.value
                  ? `${p.borderColor} ${p.bgColor}`
                  : 'border-surface-200 dark:border-surface-600 hover:border-surface-300 text-surface-600 dark:text-surface-400'
                }
              `}
            >
              <span className={p.color}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Default Tags</h4>
        <div className="flex flex-wrap gap-2">
          {tags.length > 0 ? tags.map((tag) => {
            const TagIcon = getIconByName(tag.icon || 'tag');
            const isSelected = defaultTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => handleTagToggle(tag.id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all border ${
                  isSelected
                    ? ''
                    : 'opacity-60 hover:opacity-75'
                }`}
                style={{
                  borderColor: tag.color,
                  backgroundColor: `${tag.color}15`,
                  color: tag.color,
                }}
              >
                <TagIcon className="w-3 h-3" />
                {tag.name}
              </button>
            );
          }) : (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              No tags available. Create tags first to set defaults.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
