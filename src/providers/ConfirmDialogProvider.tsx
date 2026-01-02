import { ReactNode, useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ConfirmDialogContext,
  ConfirmOptions,
  ConfirmResult,
  defaultConfirmOptions,
} from '@/context/confirmDialogContext';

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const alternateResolverRef = useRef<((value: ConfirmResult) => void) | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>(defaultConfirmOptions);

  const close = useCallback(() => {
    setIsOpen(false);
    resolverRef.current = null;
    alternateResolverRef.current = null;
  }, []);

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      alternateResolverRef.current = null;
      setOptions({ ...defaultConfirmOptions, ...opts });
      setIsOpen(true);
    });
  }, []);

  const confirmWithAlternate = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<ConfirmResult>((resolve) => {
      alternateResolverRef.current = resolve;
      resolverRef.current = null;
      setOptions({ ...defaultConfirmOptions, ...opts });
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (alternateResolverRef.current) {
      alternateResolverRef.current('confirm');
    } else {
      resolverRef.current?.(true);
    }
    close();
  }, [close]);

  const handleAlternate = useCallback(() => {
    alternateResolverRef.current?.('alternate');
    close();
  }, [close]);

  const handleCancel = useCallback(() => {
    if (alternateResolverRef.current) {
      alternateResolverRef.current('cancel');
    } else {
      resolverRef.current?.(false);
    }
    close();
  }, [close]);

  return (
    <ConfirmDialogContext.Provider value={{ confirm, confirmWithAlternate, isOpen }}>
      {children}
      <ConfirmDialog
        isOpen={isOpen}
        title={options.title || defaultConfirmOptions.title}
        message={options.message || defaultConfirmOptions.message}
        confirmLabel={options.confirmLabel || defaultConfirmOptions.confirmLabel}
        cancelLabel={options.cancelLabel || defaultConfirmOptions.cancelLabel}
        destructive={options.destructive ?? defaultConfirmOptions.destructive}
        alternateLabel={options.alternateLabel}
        alternateDestructive={options.alternateDestructive}
        onConfirm={handleConfirm}
        onAlternate={handleAlternate}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  );
}
