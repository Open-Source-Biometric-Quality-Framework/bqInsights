import { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '../utils/storage';

interface Settings {
  reportType: string;
}

/**
 * Hook to persist and manage settings in localStorage
 */
export function useSettingsPersistence(storageKey: string) {
  const [reportType, setReportType] = useState<string>(() => {
    if (typeof window === 'undefined') return 'review';
    const initial = loadSettings<Settings>(storageKey);
    return initial?.reportType ?? 'review';
  });

  // Persist settings when they change
  useEffect(() => {
    saveSettings(storageKey, { reportType });
  }, [reportType, storageKey]);

  return { reportType, setReportType };
}