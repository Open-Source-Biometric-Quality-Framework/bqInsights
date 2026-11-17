import { useCallback } from 'react';

interface LoadImageParams {
  imageFile: string;
  maxWidth?: number;
}

/**
 * Hook to load images from the file system
 * Returns a function that matches the expected signature for FormattedFieldList
 */
export function useImageLoader(activeFolder: string) {
  const loadImage = useCallback(async (
    params: LoadImageParams
  ): Promise<string | null> => {
    const { imageFile, maxWidth = 150 } = params;

    try {
      if (!window.electron?.fs?.readImageBase64) {
        console.warn('Image loading not available in this environment');
        return null;
      }

      const { success, base64 } = await window.electron.fs.readImageBase64(
        imageFile,
        activeFolder,
        { maxWidth }
      );

      if (success && base64) {
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch (err) {
      console.error("Error reading file base64:", err);
    }
    
    return null;
  }, [activeFolder]);

  return loadImage;
}