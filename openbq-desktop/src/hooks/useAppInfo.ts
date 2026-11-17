import { useState, useEffect } from 'react';
import type { AppInfo } from '../types';

/**
 * Hook to fetch and manage application information
 */
export function useAppInfo(): AppInfo | null {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    async function fetchAppInfo() {
      try {
        if (window.electron?.getAppInfo) {
          const info = await window.electron.getAppInfo();
          setAppInfo(info);
        } else {
          // Fallback for browser environment
          const info: AppInfo = { 
            name: 'DraftLoaded', 
            description: "Test", 
            version: "0.x" 
          };
          setAppInfo(info);
        }
      } catch (error) {
        console.error('INTERNAL: Failed to load app info:', error);
        // Set fallback info
        setAppInfo({ 
          name: 'DraftLoaded', 
          description: "Test", 
          version: "0.x" 
        });
      }
    }
    
    fetchAppInfo();
  }, []);

  return appInfo;
}