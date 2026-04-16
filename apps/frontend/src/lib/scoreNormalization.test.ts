import { describe, it, expect } from 'vitest';
import { normalizeScore } from '@/components/levantamentos/detail/ItemScoreBadge';

describe('normalizeScore — edge cases', () => {
  it('score 1.0 (exatamente 1) permanece 1.0 sem ser dividido por 100', () => {
    // raw > 1 triggers /100, so raw=1 (not > 1) stays as 1
    expect(normalizeScore(1.0)).toBe(1.0);
  });

  it('score 0 permanece 0', () => {
    expect(normalizeScore(0)).toBe(0);
  });

  it('score 100 é convertido para 1.0', () => {
    expect(normalizeScore(100)).toBe(1.0);
  });

  it('score 85 é convertido para 0.85', () => {
    expect(normalizeScore(85)).toBe(0.85);
  });

  it('score 1.5 (maior que 1) é tratado como escala 0-100 e retorna 0.015', () => {
    expect(normalizeScore(1.5)).toBe(0.015);
  });

  it('null retorna null', () => {
    expect(normalizeScore(null)).toBeNull();
  });

  it('undefined retorna null', () => {
    expect(normalizeScore(undefined)).toBeNull();
  });
});
