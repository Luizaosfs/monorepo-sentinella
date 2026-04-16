import { describe, it, expect, beforeEach } from 'vitest';
import { loadCache, loadCacheValue, saveCache } from './cache';

describe('cache (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveCache e loadCacheValue round-trip', () => {
    saveCache('k1', { a: 1 });
    expect(loadCacheValue<{ a: number }>('k1')).toEqual({ a: 1 });
  });

  it('loadCache retorna array ou vazio', () => {
    saveCache('arr', [1, 2]);
    expect(loadCache<number>('arr')).toEqual([1, 2]);
    expect(loadCache('missing')).toEqual([]);
  });

  it('loadCacheValue null quando ausente', () => {
    expect(loadCacheValue('none')).toBeNull();
  });
});
