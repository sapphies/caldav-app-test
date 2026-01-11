import { BaseDirectory, remove } from '@tauri-apps/plugin-fs';
import { openUrl } from '@tauri-apps/plugin-opener';
import { arch, exeExtension, locale, platform, version } from '@tauri-apps/plugin-os';
import { relaunch } from '@tauri-apps/plugin-process';
import { getUIState } from '@/lib/database';
import { createLogger, initLogger } from '@/lib/logger';
import { initializeDataStore } from '@/lib/taskData';
import { useSettingsStore } from '@/store/settingsStore';
import { initAppMenu } from '@/utils/menu';
import { version as AppVersion } from '../../package.json';

const [currentPlatform, currentArch, currentVersion, currentExtension, currentLocale] =
  await Promise.all([platform(), arch(), version(), exeExtension(), locale()]);

const log = createLogger('Bootstrap', '#a855f7');

export interface BootstrapResult {
  success: boolean;
  error?: Error;
}

export async function initializeApp(): Promise<void> {
  // Initialize logger first so all subsequent logs are captured
  await initLogger();
  log.info('Starting application initialization...');

  log.debug('Initializing data store...');
  await initializeDataStore();
  log.debug('Data store initialized');

  log.debug('Getting UI state...');
  const uiState = await getUIState();
  const sortMode = uiState.sortConfig?.mode ?? 'manual';
  const menuSortMode:
    | 'manual'
    | 'smart'
    | 'due-date'
    | 'priority'
    | 'title'
    | 'created'
    | 'modified' = sortMode === 'start-date' ? 'manual' : sortMode;

  const shortcuts = useSettingsStore.getState().keyboardShortcuts;
  log.debug('Loaded keyboard shortcuts');

  // initialize macOS application menu with current state and user shortcuts
  log.debug('Initializing app menu...');
  await initAppMenu({
    showCompleted: uiState.showCompletedTasks,
    sortMode: menuSortMode,
    shortcuts,
  });

  log.info('Application initialization complete');
}

export async function showWindow(delay: number = 200): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const window = getCurrentWindow();
      await window.show();
      await window.setFocus();
      log.debug('Window shown and focused');
      resolve();
    }, delay);
  });
}

/**
 * delete the database file and restart the app (for worst-case recovery)
 */
export async function deleteDatabase(): Promise<void> {
  try {
    log.warn('Deleting database file...');
    await remove('caldav-tasks.db', { baseDir: BaseDirectory.AppLocalData });
    log.info('Database file deleted successfully');

    // Relaunch the app so migrations run on the fresh database
    log.info('Relaunching app to reinitialize database...');
    await relaunch();
  } catch (error) {
    log.error('Failed to delete database:', error);
    throw error;
  }
}

/**
 * display an error message in the DOM when initialization fails
 *
 * @param error - the error that occurred during initialization
 */
export function showBootstrapError(error: unknown): void {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full py-10">
        <h1 class="text-2xl font-extrabold text-red-600">Oh no!! :(</h1>
        <p class="text-black dark:text-white mb-4">
          The application encountered a critical error during startup. Please see the details below.
        </p>
        <pre class="bg-gray-800 text-gray-100 max-w-2xl p-4 rounded mb-6 overflow-auto whitespace-pre-line">
          ${error}
        </pre>

        <div class="flex flex-col gap-10 pt-3">
          <div class="flex flex-col justify-center max-w-2xl border border-gray-700 bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 class="text-orange-300 mb-2 text-xl font-bold">Report issue</h2>
            <p class="mb-3 text-sm text-white">
              You can help us fix this issue by making a bug report below.
            </p>
            <button
              id="fileIssueBtn"
              class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Automatically file issue on GitHub
            </button>
          </div>

          <div class="flex flex-col justify-center max-w-2xl border border-gray-700 bg-gray-800 p-6 rounded-lg shadow-md">
            <h2 class="text-orange-300 mb-2 text-xl font-bold">⚠️ Reset Database</h2>
            <p class="mb-3 text-sm text-white">
              If the database is corrupted, you can reset it.
            </p>
            <p class="mb-3 text-sm text-white">
              This will delete all local data including CalDAV accounts, local (non-CalDAV) tasks, and potentially tags.
            </p>
            <p class="mb-4 text-sm text-white">
              This won't delete any tasks or data on your CalDAV server, only local data, but you'll need to set up your CalDAV accounts again on this app.
            </p>
            <div id="resetConfirmSection" class="hidden">
              <p class="text-sm text-yellow-400 font-semibold">Are you sure? This action cannot be undone.</p>
              <div class="flex gap-3 pt-3">
                <button
                  id="resetConfirmBtn"
                  class="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-medium py-2 px-4 rounded"
                >
                  Yes, Reset Database
                </button>
                <button
                  id="resetCancelBtn"
                  class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
            <button
              id="resetBtn"
              class="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-medium py-2 px-4 rounded"
            >
              Reset Database and Reload
            </button>
          </div>
        </div>
      </div>
    `;

    // Add click handlers for reset button
    const resetBtn = document.getElementById('resetBtn');
    const resetConfirmSection = document.getElementById('resetConfirmSection');
    const resetConfirmBtn = document.getElementById('resetConfirmBtn');
    const resetCancelBtn = document.getElementById('resetCancelBtn');
    const fileIssueBtn = document.getElementById('fileIssueBtn');

    if (fileIssueBtn) {
      fileIssueBtn.addEventListener('click', async () => {
        const errorTitle = `Critical startup error on ${currentPlatform} ${currentVersion}`;
        const errorBody = `**System Information:**
\`\`\`
App Version: ${AppVersion}
OS: ${currentPlatform}
Version: ${currentVersion}
Architecture: ${currentArch}
App Extension: ${currentExtension || 'Unknown'}
System Locale: ${currentLocale}
\`\`\`

**Stacktrace:**
\`\`\`
${error}
\`\`\`

**Steps to reproduce:**
<!-- Describe the steps that led to this error -->

**Additional context:**
<!-- Any additional information that might help us debug this issue -->`;

        const issueUrl = `https://github.com/sapphies/caldav-tasks/issues/new?title=${encodeURIComponent(errorTitle)}&body=${encodeURIComponent(errorBody)}`;
        await openUrl(issueUrl);
      });
    }

    if (resetBtn && resetConfirmSection && resetConfirmBtn && resetCancelBtn) {
      resetBtn.addEventListener('click', () => {
        resetBtn.classList.add('hidden');
        resetConfirmSection.classList.remove('hidden');
      });

      resetCancelBtn.addEventListener('click', () => {
        resetConfirmSection.classList.add('hidden');
        resetBtn.classList.remove('hidden');
      });

      resetConfirmBtn.addEventListener('click', async () => {
        resetConfirmBtn.textContent = 'Resetting...';
        resetConfirmBtn.setAttribute('disabled', 'true');

        try {
          await deleteDatabase();
        } catch (err) {
          resetConfirmBtn.textContent = 'Reset Failed';
          alert(`Failed to reset database: ${err}`);
        }
      });
    }
  }
}

export async function forceShowWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().show();
}
