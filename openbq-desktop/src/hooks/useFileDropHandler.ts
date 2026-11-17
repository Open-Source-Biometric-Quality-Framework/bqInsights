import { useEffect } from 'react';
import { openDocxAsHtml } from '../fileActions';
import type { OpenFileResult } from '../types';

/**
 * Hook to handle file drag-and-drop functionality
 */
export function useFileDropHandler(
  onFileOpened: (file: OpenFileResult, token?: number) => void,
  onOpenStart?: () => number,
  onOpenFinish?: (opened: boolean, token?: number) => void,
  onError?: (error: Error) => void
): void {
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault(); // REQUIRED for "+" and for drop to work
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      
      const dt = e.dataTransfer;
      if (!dt) return;

      console.log("types:", Array.from(dt.types ?? []));
      console.log("files.length:", dt.files?.length ?? 0);
      console.log("items:", Array.from(dt.items ?? []).map(i => ({ kind: i.kind, type: i.type })));
      console.log("uri-list:", dt.getData("text/uri-list"));
      console.log("text/plain:", dt.getData("text/plain"));

      const files = Array.from(dt.files ?? []);
      const paths = files
        .map((f: any) => window.electron?.getPathForFile(f))
        .filter(Boolean) as string[];

      // Only accept docx/xlsx
      const first = paths.find(p => /\.(docx|xlsx)$/i.test(p));
      console.log("DROP paths:", paths);

      if (!first) return;

      try {
        const token = onOpenStart?.();
        const file = await openDocxAsHtml(first);
        if (file) {
          onOpenFinish?.(true, token);
          onFileOpened(file, token);
        } else {
          onOpenFinish?.(false, token);
        }
      } catch (err) {
        onOpenFinish?.(false);
        console.error("Failed to open dropped file:", err);
        onError?.(err as Error);
      }
    };

    // Register on BOTH window + document to avoid edge cases
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [onFileOpened, onError]);
}
