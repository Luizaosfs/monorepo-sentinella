import { describe, it, expect } from 'vitest';
import { normalizeScore, getScoreConfig } from './ItemScoreBadge';

describe('normalizeScore', () => {
  // ── Null / undefined inputs ──────────────────────────────────────────────

  it('returns null for null input', () => {
    expect(normalizeScore(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeScore(undefined)).toBeNull();
  });

  // ── Already 0-1 range ────────────────────────────────────────────────────

  it('returns 0.87 unchanged when input is 0.87 (0-1 range)', () => {
    expect(normalizeScore(0.87)).toBe(0.87);
  });

  it('returns 0 unchanged when input is 0', () => {
    expect(normalizeScore(0)).toBe(0);
  });

  it('returns 1 unchanged when input is 1', () => {
    expect(normalizeScore(1)).toBe(1);
  });

  it('returns 0.5 unchanged when input is 0.5', () => {
    expect(normalizeScore(0.5)).toBe(0.5);
  });

  it('returns 0.001 unchanged (very low score in 0-1 range)', () => {
    expect(normalizeScore(0.001)).toBe(0.001);
  });

  // ── 0-100 range inputs ───────────────────────────────────────────────────

  it('converts 87 to 0.87 (0-100 range)', () => {
    expect(normalizeScore(87)).toBe(0.87);
  });

  it('converts 100 to 1 (0-100 range)', () => {
    expect(normalizeScore(100)).toBe(1);
  });

  it('converts 50 to 0.5 (0-100 range)', () => {
    expect(normalizeScore(50)).toBe(0.5);
  });

  it('converts 65 to 0.65 (0-100 range)', () => {
    expect(normalizeScore(65)).toBe(0.65);
  });

  it('converts 2 to 0.02 (value > 1 triggers division)', () => {
    // Any value > 1 is treated as 0-100 scale
    expect(normalizeScore(2)).toBe(0.02);
  });

  // ── Boundary value at exactly 1 ─────────────────────────────────────────

  it('treats exactly 1 as already normalized (not divided by 100)', () => {
    // raw > 1 triggers /100, so raw=1 stays as 1
    expect(normalizeScore(1)).toBe(1);
  });
});

describe('getScoreConfig', () => {
  // ── Confidence levels ────────────────────────────────────────────────────

  it('returns "Muito alta" label for score >= 0.85', () => {
    expect(getScoreConfig(0.85).label).toBe('Muito alta');
    expect(getScoreConfig(0.90).label).toBe('Muito alta');
    expect(getScoreConfig(1.0).label).toBe('Muito alta');
  });

  it('returns "Alta" label for score >= 0.65 and < 0.85', () => {
    expect(getScoreConfig(0.65).label).toBe('Alta');
    expect(getScoreConfig(0.75).label).toBe('Alta');
    expect(getScoreConfig(0.84).label).toBe('Alta');
  });

  it('returns "Média" label for score >= 0.45 and < 0.65', () => {
    expect(getScoreConfig(0.45).label).toBe('Média');
    expect(getScoreConfig(0.55).label).toBe('Média');
    expect(getScoreConfig(0.64).label).toBe('Média');
  });

  it('returns "Baixa" label for score >= 0.25 and < 0.45', () => {
    expect(getScoreConfig(0.44).label).toBe('Baixa');
    expect(getScoreConfig(0.30).label).toBe('Baixa');
    expect(getScoreConfig(0.25).label).toBe('Baixa');
  });

  it('returns "Muito baixa" label for score < 0.25', () => {
    expect(getScoreConfig(0.24).label).toBe('Muito baixa');
    expect(getScoreConfig(0.10).label).toBe('Muito baixa');
    expect(getScoreConfig(0.0).label).toBe('Muito baixa');
  });

  // ── Color classes ────────────────────────────────────────────────────────

  it('uses emerald bar for Muito alta', () => {
    expect(getScoreConfig(0.90).barColor).toContain('emerald');
  });

  it('uses blue bar for Alta', () => {
    expect(getScoreConfig(0.70).barColor).toContain('blue');
  });

  it('uses amber bar for Média', () => {
    expect(getScoreConfig(0.50).barColor).toContain('amber');
  });

  it('uses orange bar for Baixa', () => {
    expect(getScoreConfig(0.30).barColor).toContain('orange');
  });

  it('uses red bar for Muito baixa', () => {
    expect(getScoreConfig(0.10).barColor).toContain('red');
    expect(getScoreConfig(0.10).label).toBe('Muito baixa');
  });

  // ── Return shape ─────────────────────────────────────────────────────────

  it('always returns label, barColor, and textColor', () => {
    const config = getScoreConfig(0.75);
    expect(config).toHaveProperty('label');
    expect(config).toHaveProperty('barColor');
    expect(config).toHaveProperty('textColor');
  });
});
