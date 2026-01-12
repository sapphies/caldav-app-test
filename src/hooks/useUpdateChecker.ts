import { useCallback, useEffect, useState } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('Updater', '#10b981');

// Check if we're in a Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
  currentVersion: string;
}

export interface UseUpdateCheckerResult {
  updateAvailable: UpdateInfo | null;
  isChecking: boolean;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismissUpdate: () => void;
  isDownloading: boolean;
  downloadProgress: number;
}

export function useUpdateChecker(): UseUpdateCheckerResult {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (!isTauri) {
      log.info('Not in Tauri environment, skipping update check');
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { getVersion } = await import('@tauri-apps/api/app');

      const currentVersion = await getVersion();
      log.info(`Current version: ${currentVersion}`);

      const update = await check();

      if (update) {
        log.info(`Update available: ${update.version}`);
        setUpdateAvailable({
          version: update.version,
          body: update.body,
          date: update.date,
          currentVersion,
        });
      } else {
        log.info('No updates available');
        setUpdateAvailable(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check for updates';
      log.error('Update check failed:', err);
      setError(message);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!isTauri || !updateAvailable) {
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');

      const update = await check();
      if (!update) {
        throw new Error('Update no longer available');
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            log.info(`Download started: ${contentLength} bytes`);
            break;
          case 'Progress': {
            downloaded += event.data.chunkLength;
            const progress = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
            setDownloadProgress(progress);
            break;
          }
          case 'Finished':
            log.info('Download finished');
            setDownloadProgress(100);
            break;
        }
      });

      log.info('Update installed, relaunching...');
      await relaunch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download update';
      log.error('Update download failed:', err);
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  }, [updateAvailable]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
    setUpdateAvailable(null);
  }, []);

  // Check for updates on mount (after a short delay to not block startup)
  useEffect(() => {
    if (!isTauri) return;

    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000); // Check 5 seconds after app starts

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    updateAvailable: dismissed ? null : updateAvailable,
    isChecking,
    error,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
    isDownloading,
    downloadProgress,
  };
}
