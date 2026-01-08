import { useEffect, useContext, useRef } from 'react';
import { ConfirmDialogContext } from '@/context/confirmDialogContext';

// track all active modal escape handlers in order of registration
// this allows proper nesting - only the topmost modal should handle Esc
const activeHandlers: Set<symbol> = new Set();

/**
 * hook to close a modal when the Escape key is pressed
 * won't trigger if a confirm dialog is open (to allow proper nesting)
 * only the most recently registered handler will respond to Escape
 * @param onClose - callback to execute when Escape is pressed
 * @param options - configuration options
 * @param options.isPanel - if true, this is a panel (like TaskEditor) that should yield to modals
 */
export function useModalEscapeKey(onClose: () => void, options?: { isPanel?: boolean }) {
  const confirmDialogContext = useContext(ConfirmDialogContext);
  const handlerIdRef = useRef<symbol | null>(null);
  const isPanelRef = useRef(options?.isPanel ?? false);
  
  useEffect(() => {
    // create a unique identifier for this handler
    const handlerId = Symbol('modal-escape-handler');
    handlerIdRef.current = handlerId;
    activeHandlers.add(handlerId);

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // don't handle if a confirm dialog is open - let it handle the escape
        if (confirmDialogContext?.isOpen) {
          return;
        }

        // get all handlers as an array and check if this is the topmost one
        const handlersArray = Array.from(activeHandlers);
        const myIndex = handlersArray.indexOf(handlerId);

        // if this is a panel, only respond if it's the only handler
        // (no other modals are open on top of it)
        if (isPanelRef.current && handlersArray.length > 1) {
          return;
        }

        // only the last registered (topmost) handler should respond
        if (myIndex !== handlersArray.length - 1) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // blur active element to prevent focus ring on underlying elements
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc, { capture: true });

    return () => {
      activeHandlers.delete(handlerId);
      window.removeEventListener('keydown', handleEsc, { capture: true } as EventListenerOptions);
    };
  }, [onClose, confirmDialogContext?.isOpen]);
}
