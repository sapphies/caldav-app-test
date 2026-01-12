import ArrowDownToLine from 'lucide-react/icons/arrow-down-to-line';
import RefreshCw from 'lucide-react/icons/refresh-cw';
import X from 'lucide-react/icons/x';
import type { UpdateInfo } from '@/hooks/useUpdateChecker';

interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  onDownload: () => void;
  onDismiss: () => void;
  isDownloading: boolean;
  downloadProgress: number;
}

export function UpdateBanner({
  updateInfo,
  onDownload,
  onDismiss,
  isDownloading,
  downloadProgress,
}: UpdateBannerProps) {
  return (
    <div className="bg-primary-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-3">
      {isDownloading ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Downloading update... {Math.round(downloadProgress)}%</span>
          <div className="w-32 h-2 bg-primary-400 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <span>
            A new version is available: <strong>v{updateInfo.version}</strong> (you have v
            {updateInfo.currentVersion})
          </span>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Update Now
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
