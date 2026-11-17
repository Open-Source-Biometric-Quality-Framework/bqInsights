/**
 * Utility functions for data formatting
 */

/**
 * Get the base filename from a full path
 */
export function getBaseName(path: string): string {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts.pop() || '';
}

/**
 * Round a number to specified decimal places
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Convert a decimal value to percentage string
 */
export function toPercent(value: number | undefined, decimals: number = 4): string {
  if (!value) return "";
  return `${100 * roundTo(value, decimals)}%`;
}