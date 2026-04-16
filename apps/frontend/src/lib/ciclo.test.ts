import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentCiclo } from './ciclo';

describe('getCurrentCiclo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Jan–Fev → ciclo 1', () => {
    vi.setSystemTime(new Date('2026-01-20T12:00:00.000Z'));
    expect(getCurrentCiclo()).toBe(1);
    vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'));
    expect(getCurrentCiclo()).toBe(1);
  });

  it('Mar–Abr → ciclo 2', () => {
    vi.setSystemTime(new Date('2026-03-05T12:00:00.000Z'));
    expect(getCurrentCiclo()).toBe(2);
  });

  it('Nov–Dez → ciclo 6', () => {
    vi.setSystemTime(new Date('2026-11-30T12:00:00.000Z'));
    expect(getCurrentCiclo()).toBe(6);
    vi.setSystemTime(new Date('2026-12-01T12:00:00.000Z'));
    expect(getCurrentCiclo()).toBe(6);
  });
});
