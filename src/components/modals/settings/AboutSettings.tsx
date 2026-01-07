import packageJson from '../../../../package.json';

export function AboutSettings() {
  const appInfo = packageJson as { version?: string; name?: string; description?: string; author: string; };
  const appVersion = appInfo.version || 'dev';
  const appName = appInfo.name || 'caldav app test';
  const appDescription = appInfo.description || 'A CalDAV-compatible task management client.';
  const appAuthor = appInfo.author;

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-surface-800 dark:text-surface-200 mb-1">{appName}</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">Version {appVersion}</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-2">About</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            {appDescription}
          </p>
        </div>

        <div className="p-4 bg-surface-50 dark:bg-surface-700 rounded-lg">
          <h3 className="text-sm font-medium text-surface-800 dark:text-surface-200 mb-2">Credits</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            {appAuthor}
          </p>
        </div>
      </div>
    </div>
  );
}
