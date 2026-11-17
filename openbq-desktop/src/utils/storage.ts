/**
 * Utility functions for browser storage operations
 */

/**
 * Set a cookie with configurable expiration
 */
export const setCookie = (name: string, value: string, days: number = 365): void => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

/**
 * Get a cookie value by name
 */
export const getCookie = (name: string): string | null => {
  const key = encodeURIComponent(name) + '=';
  const parts = document.cookie.split('; ').find(row => row.startsWith(key));
  return parts ? decodeURIComponent(parts.slice(key.length)) : null;
};

/**
 * Load settings from localStorage with error handling
 */
export const loadSettings = <T>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    console.warn(`Failed to load settings from localStorage (key: ${key})`);
    return null;
  }
};

/**
 * Save settings to localStorage with error handling
 */
export const saveSettings = <T>(key: string, value: T): boolean => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn(`Failed to save settings to localStorage (key: ${key})`);
    return false;
  }
};