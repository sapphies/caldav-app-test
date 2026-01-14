interface DragOverlayProps {
  isUnsupportedFile: boolean;
}

export function DragOverlay({ isUnsupportedFile }: DragOverlayProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm ${
        isUnsupportedFile ? 'bg-red-600/10' : 'bg-primary-600/10'
      }`}
    >
      <div
        className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg border ${
          isUnsupportedFile
            ? 'bg-red-50/90 dark:bg-red-900/90 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
            : 'bg-white/90 dark:bg-surface-800/90 text-surface-800 dark:text-surface-200 border-primary-200 dark:border-primary-800'
        }`}
      >
        {isUnsupportedFile
          ? 'Unsupported file format. Only .ics and .json files are supported.'
          : 'Drop .ics or .json files anywhere to import tasks'}
      </div>
    </div>
  );
}
