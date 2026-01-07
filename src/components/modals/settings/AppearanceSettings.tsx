import Sun from 'lucide-react/icons/sun';
import Moon from 'lucide-react/icons/moon';
import Monitor from 'lucide-react/icons/monitor';
import { useSettingsStore, type Theme } from '@/store/settingsStore';
import { ACCENT_COLORS } from '@/utils/constants';

export function AppearanceSettings() {
  const { 
    theme, 
    setTheme, 
    accentColor, 
    setAccentColor,
  } = useSettingsStore();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">Appearance</h3>
      <div className="space-y-4 rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
        <div>
          <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Theme</h4>
          <div className="flex gap-2">
            {[
              { value: 'light' as Theme, icon: <Sun className="w-4 h-4" />, label: 'Light' },
              { value: 'dark' as Theme, icon: <Moon className="w-4 h-4" />, label: 'Dark' },
              { value: 'system' as Theme, icon: <Monitor className="w-4 h-4" />, label: 'System' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${
                  theme === option.value
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 text-surface-600 dark:text-surface-400'
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-3">Accent Color</h4>
          <div className="flex gap-2">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setAccentColor(color.value)}
                title={color.name}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  accentColor === color.value
                    ? 'border-surface-800 dark:border-white scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
