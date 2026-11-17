// cacheService.ts - Cache management utilities

import type { CachedAnalysis } from '../utils/types';

const OPENBQ_CACHE_PREFIX = 'openbq:analysis:v1';
const LAST_CACHE_SUFFIX = ':last';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DISK_CACHE_DIR = 'openbq-analysis-cache';
const LAST_KEYS_FILE = 'last-cache-keys.json';
const ENTRY_FILE_PREFIX = 'analysis-';
const ENTRY_FILE_EXT = '.json';

type DiskCachedAnalysis = CachedAnalysis & { key: string };
type LastCacheMap = Record<string, { key: string; timestamp: number }>;

let cacheRootPromise: Promise<string | null> | null = null;

export function makeLocalStorageKey(
  modality: string,
  dir: string,
  profile: string,
  strict: boolean
): string {
  return `${OPENBQ_CACHE_PREFIX}:${modality}:${dir}:${profile}:${strict}`;
}

function isDiskCacheAvailable(): boolean {
  return Boolean(
    window.electron?.getPath &&
      window.electron?.fs?.readFile &&
      window.electron?.fs?.writeFileAbsolute &&
      window.electron?.fs?.readDir
  );
}

function joinPath(basePath: string, fileName: string): string {
  const separator = basePath.includes('\\') && !basePath.includes('/') ? '\\' : '/';
  return `${basePath.replace(/[\\/]+$/, '')}${separator}${fileName}`;
}

function hashKey(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function getCacheRootPath(): Promise<string | null> {
  if (!isDiskCacheAvailable()) return null;

  if (!cacheRootPromise) {
    cacheRootPromise = (async () => {
      try {
        const userDataPath = await window.electron?.getPath?.('userData');
        if (!userDataPath) return null;
        const rootPath = joinPath(userDataPath, DISK_CACHE_DIR);
        await window.electron?.fs?.ensureDir?.(rootPath);
        return rootPath;
      } catch (err) {
        console.warn('Failed to initialize disk cache directory', err);
        return null;
      }
    })();
  }

  return cacheRootPromise;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const res = await window.electron?.fs?.readFile?.(filePath);
    if (!res?.success || !res.content) return null;
    return JSON.parse(res.content) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<boolean> {
  try {
    const res = await window.electron?.fs?.writeFileAbsolute?.(
      filePath,
      JSON.stringify(payload)
    );
    return Boolean(res?.success);
  } catch (err) {
    console.warn('Failed writing cache file', err);
    return false;
  }
}

async function deleteDiskFile(filePath: string): Promise<void> {
  try {
    const res = await window.electron?.fs?.deleteFileAbsolute?.(filePath);
    if (res?.success) return;
  } catch {
    // fall through to truncate fallback
  }

  await window.electron?.fs?.writeFileAbsolute?.(filePath, '');
}

async function readDiskCacheEntry(key: string): Promise<DiskCachedAnalysis | null> {
  const rootPath = await getCacheRootPath();
  if (!rootPath) return null;

  const filePath = joinPath(rootPath, `${ENTRY_FILE_PREFIX}${hashKey(key)}${ENTRY_FILE_EXT}`);
  const parsed = await readJsonFile<DiskCachedAnalysis>(filePath);
  if (!parsed || parsed.key !== key) return null;

  if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
    await deleteDiskFile(filePath);
    return null;
  }

  return parsed;
}

async function writeDiskCacheEntry(key: string, analysis: any): Promise<void> {
  const rootPath = await getCacheRootPath();
  if (!rootPath) return;

  const filePath = joinPath(rootPath, `${ENTRY_FILE_PREFIX}${hashKey(key)}${ENTRY_FILE_EXT}`);
  const payload: DiskCachedAnalysis = {
    key,
    timestamp: Date.now(),
    analysis
  };
  await writeJsonFile(filePath, payload);
}

async function readLastCacheMap(): Promise<LastCacheMap> {
  const rootPath = await getCacheRootPath();
  if (!rootPath) return {};
  const filePath = joinPath(rootPath, LAST_KEYS_FILE);
  const parsed = await readJsonFile<LastCacheMap>(filePath);
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed;
}

async function writeLastCacheMap(map: LastCacheMap): Promise<void> {
  const rootPath = await getCacheRootPath();
  if (!rootPath) return;
  const filePath = joinPath(rootPath, LAST_KEYS_FILE);
  await writeJsonFile(filePath, map);
}

export async function loadFromLocalStorage(key: string): Promise<any | null> {
  if (isDiskCacheAvailable()) {
    const diskCached = await readDiskCacheEntry(key);
    if (diskCached) return diskCached.analysis;
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed: CachedAnalysis = JSON.parse(raw);

    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.analysis;
  } catch (err) {
    console.warn('Failed to read cache', err);
    localStorage.removeItem(key);
    return null;
  }
}

export async function saveToLocalStorage(key: string, analysis: any): Promise<void> {
  if (isDiskCacheAvailable()) {
    await writeDiskCacheEntry(key, analysis);
    return;
  }

  try {
    const payload: CachedAnalysis = {
      timestamp: Date.now(),
      analysis
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to write cache (quota?)', err);
  }
}

export async function saveLastCacheKey(baseKey: string, fullKey: string): Promise<void> {
  if (isDiskCacheAvailable()) {
    const currentMap = await readLastCacheMap();
    currentMap[baseKey] = {
      key: fullKey,
      timestamp: Date.now()
    };
    await writeLastCacheMap(currentMap);
    return;
  }

  try {
    const payload = {
      key: fullKey,
      timestamp: Date.now()
    };
    localStorage.setItem(`${baseKey}${LAST_CACHE_SUFFIX}`, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to write last cache key', err);
  }
}

export async function loadLastCacheKey(baseKey: string): Promise<string | null> {
  if (isDiskCacheAvailable()) {
    const map = await readLastCacheMap();
    const payload = map[baseKey];
    if (!payload || typeof payload.key !== 'string') return null;

    if (Date.now() - payload.timestamp > CACHE_TTL_MS) {
      delete map[baseKey];
      await writeLastCacheMap(map);
      return null;
    }

    return payload.key;
  }

  try {
    const raw = localStorage.getItem(`${baseKey}${LAST_CACHE_SUFFIX}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.key !== 'string') {
      localStorage.removeItem(`${baseKey}${LAST_CACHE_SUFFIX}`);
      return null;
    }

    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(`${baseKey}${LAST_CACHE_SUFFIX}`);
      return null;
    }

    return parsed.key;
  } catch (err) {
    console.warn('Failed to read last cache key', err);
    localStorage.removeItem(`${baseKey}${LAST_CACHE_SUFFIX}`);
    return null;
  }
}

export async function clearCache(key?: string): Promise<void> {
  if (isDiskCacheAvailable()) {
    const rootPath = await getCacheRootPath();
    if (!rootPath) return;

    const lastMap = await readLastCacheMap();

    if (key) {
      const filePath = joinPath(rootPath, `${ENTRY_FILE_PREFIX}${hashKey(key)}${ENTRY_FILE_EXT}`);
      await deleteDiskFile(filePath);

      Object.keys(lastMap).forEach((baseKey) => {
        if (baseKey === key || lastMap[baseKey]?.key === key) {
          delete lastMap[baseKey];
        }
      });
      await writeLastCacheMap(lastMap);
      return;
    }

    const listRes = await window.electron?.fs?.readDir?.(rootPath);
    const entries = listRes?.success ? listRes.entries : [];
    for (const entry of entries) {
      if (!entry.isFile) continue;
      if (entry.name.startsWith(ENTRY_FILE_PREFIX) && entry.name.endsWith(ENTRY_FILE_EXT)) {
        const filePath = joinPath(rootPath, entry.name);
        await deleteDiskFile(filePath);
      }
    }

    await writeLastCacheMap({});
    return;
  }

  if (key) {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}${LAST_CACHE_SUFFIX}`);
  } else {
    // Clear all OpenBQ cache entries
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(OPENBQ_CACHE_PREFIX)) {
        localStorage.removeItem(k);
      }
    });
  }
}
