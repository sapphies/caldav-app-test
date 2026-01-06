import { useState, useCallback } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('FileDrop', '#eab308');

// Supported file extensions for import
const SUPPORTED_EXTENSIONS = ['.ics', '.ical', '.json'];

function isSupportedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export interface FileDropResult {
  name: string;
  content: string;
}

export interface UseFileDropOptions {
  onFileDrop?: (file: FileDropResult) => void;
}

export interface UseFileDropReturn {
  isDragOver: boolean;
  isUnsupportedFile: boolean;
  handleFileDrop: (e: React.DragEvent) => Promise<void>;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
}

/**
 * Hook for handling file drag and drop functionality
 * Supports .ics, .ical, and .json files for task import
 */
export function useFileDrop(options: UseFileDropOptions = {}): UseFileDropReturn {
  const { onFileDrop } = options;
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUnsupportedFile, setIsUnsupportedFile] = useState(false);

  // Check if dragged files are supported
  const checkDraggedFiles = useCallback((e: React.DragEvent): boolean => {
    const items = e.dataTransfer?.items;
    if (!items || items.length === 0) return true; // Default to supported if we can't check

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        // Try to get filename from type or check DataTransferItemList
        const file = item.getAsFile?.();
        if (file && !isSupportedFile(file.name)) {
          return false;
        }
      }
    }
    return true;
  }, []);

  // handle file drop for import
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setIsUnsupportedFile(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    // Check if it's a supported file type
    if (!isSupportedFile(file.name)) {
      // Unsupported file - don't do anything (already showed feedback during drag)
      return;
    }

    // check if it's a calendar or task file
    const isIcs = file.name.endsWith('.ics') || file.name.endsWith('.ical');
    const isJson = file.name.endsWith('.json');

    if (isIcs || isJson) {
      try {
        const content = await file.text();
        // check if JSON is a tasks file (not settings)
        if (isJson) {
          try {
            const parsed = JSON.parse(content);
            // check if it looks like a tasks export (array with task properties)
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
              onFileDrop?.({ name: file.name, content });
            }
          } catch {
            // not valid JSON, ignore
          }
        } else {
          onFileDrop?.({ name: file.name, content });
        }
      } catch (err) {
        log.error('Failed to read dropped file:', err);
      }
    }
  }, [onFileDrop]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if files are supported and update visual feedback
    const isSupported = checkDraggedFiles(e);
    setIsUnsupportedFile(!isSupported);
    
    // Set the dropEffect to show appropriate cursor
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = isSupported ? 'copy' : 'none';
    }

    setIsDragOver(true);
  }, [checkDraggedFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isSupported = checkDraggedFiles(e);
    setIsUnsupportedFile(!isSupported);

    setIsDragOver(true);
  }, [checkDraggedFiles]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setIsUnsupportedFile(false);
    }
  }, []);

  return {
    isDragOver,
    isUnsupportedFile,
    handleFileDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
  };
}
