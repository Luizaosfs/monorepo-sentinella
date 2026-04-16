import { describe, it, expect } from 'vitest';
import { STALE, GC, queryClientDefaults } from './queryConfig';

describe('queryConfig', () => {
  it('STALE.LIVE é zero (sempre refetch)', () => {
    expect(STALE.LIVE).toBe(0);
  });

  it('STALE.SHORT é 1 minuto em ms', () => {
    expect(STALE.SHORT).toBe(60_000);
  });

  it('STALE.MEDIUM é 3 minutos', () => {
    expect(STALE.MEDIUM).toBe(3 * 60_000);
  });

  it('STALE.SESSION é Infinity', () => {
    expect(STALE.SESSION).toBe(Infinity);
  });

  it('GC.EXTENDED é 30 minutos', () => {
    expect(GC.EXTENDED).toBe(30 * 60_000);
  });

  it('queryClientDefaults define staleTime e gcTime', () => {
    expect(queryClientDefaults.queries.staleTime).toBe(STALE.MEDIUM);
    expect(queryClientDefaults.queries.gcTime).toBe(GC.EXTENDED);
    expect(queryClientDefaults.queries.retry).toBe(1);
    expect(queryClientDefaults.queries.refetchOnWindowFocus).toBe(false);
  });
});
