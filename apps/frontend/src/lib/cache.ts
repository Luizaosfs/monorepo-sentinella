const CACHE_PREFIX = 'sentinela_cache_';

export const loadCache = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const loadCacheValue = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveCache = (key: string, data: unknown) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
};
