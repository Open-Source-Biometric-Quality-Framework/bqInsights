import { useRef, useEffect } from 'react';
import { openDocxAsHtml } from '../fileActions';
import type { OpenFileResult } from '../types';

interface MenuActionsOptions {
  onOpen?: (file: OpenFileResult, token?: number) => void;
  onOpenStart?: () => number;
  onOpenFinish?: (opened: boolean, token?: number) => void;
  onClose?: () => void;
  onPrint?: () => void;
  onHelp?: () => void;
  onExportBundle?: () => void;
  onImportBundle?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to manage Electron menu actions
 */
export function useMenuActions(options: MenuActionsOptions): void {
  const { onOpen, onOpenStart, onOpenFinish, onClose, onPrint, onHelp, onExportBundle, onImportBundle, onError } = options;
  
  const onOpenRef = useRef(onOpen);
  const onOpenStartRef = useRef(onOpenStart);
  const onOpenFinishRef = useRef(onOpenFinish);
  const onCloseRef = useRef(onClose);
  const onPrintRef = useRef(onPrint);
  const onHelpRef = useRef(onHelp);
  const onExportBundleRef = useRef(onExportBundle);
  const onImportBundleRef = useRef(onImportBundle);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onOpenRef.current = onOpen;
    onOpenStartRef.current = onOpenStart;
    onOpenFinishRef.current = onOpenFinish;
    onCloseRef.current = onClose;
    onPrintRef.current = onPrint;
    onHelpRef.current = onHelp;
    onExportBundleRef.current = onExportBundle;
    onImportBundleRef.current = onImportBundle;
    onErrorRef.current = onError;
  }, [onOpen, onOpenStart, onOpenFinish, onClose, onPrint, onHelp, onExportBundle, onImportBundle, onError]);

  useEffect(() => {
    if (!window.electron?.menu) return;

    let offOpen: undefined | (() => void);
    let offClose: undefined | (() => void);
    let offHelp: undefined | (() => void);
    let offPrint: undefined | (() => void);
    let offExportBundle: undefined | (() => void);
    let offImportBundle: undefined | (() => void);

    try {
      // Register menu handlers
      if (onOpenRef.current && window.electron.menu.onOpen) {
        offOpen = window.electron.menu.onOpen(async () => {
          try {
            const token = onOpenStartRef.current?.();
            const file = await openDocxAsHtml();
            if (file) {
              onOpenFinishRef.current?.(true, token);
              onOpenRef.current?.(file, token);
            } else {
              onOpenFinishRef.current?.(false, token);
            }
          } catch (error) {
            onOpenFinishRef.current?.(false);
            onErrorRef.current?.(error as Error);
          }
        });
      }

      if (onCloseRef.current && window.electron.menu.onClose) {
        offClose = window.electron.menu.onClose(() => {
          onCloseRef.current?.();
        });
      }

      if (onHelpRef.current && window.electron.menu.onHelp) {
        offHelp = window.electron.menu.onHelp(() => {
          onHelpRef.current?.();
        });
      }

      if (onPrintRef.current && window.electron.menu.onPrint) {
        offPrint = window.electron.menu.onPrint(() => {
          onPrintRef.current?.();
        });
      }

      if (onExportBundleRef.current && window.electron.menu.onExportBundle) {
        offExportBundle = window.electron.menu.onExportBundle(() => {
          onExportBundleRef.current?.();
        });
      }

      if (onImportBundleRef.current && window.electron.menu.onImportBundle) {
        offImportBundle = window.electron.menu.onImportBundle(() => {
          onImportBundleRef.current?.();
        });
      }
    } catch (error) {
      console.error("INTERNAL: could not register electron callbacks", error);
    }

    // Cleanup
    return () => {
      offOpen?.();
      offClose?.();
      offHelp?.();
      offPrint?.();
      offExportBundle?.();
      offImportBundle?.();
    };
  }, []);
}
