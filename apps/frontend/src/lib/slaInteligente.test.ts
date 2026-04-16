import { describe, it, expect } from 'vitest';
import { formatarTempoMin, SEVERIDADE_SLA_INT } from './slaInteligente';

describe('formatarTempoMin', () => {
  // ── Valores nulos ─────────────────────────────────────────────────────────
  it('null → "—"', () => {
    expect(formatarTempoMin(null)).toBe('—');
  });

  it('undefined → "—"', () => {
    expect(formatarTempoMin(undefined)).toBe('—');
  });

  // ── Menos de 1 hora ───────────────────────────────────────────────────────
  it('0 → "0m"', () => {
    expect(formatarTempoMin(0)).toBe('0m');
  });

  it('45 → "45m"', () => {
    expect(formatarTempoMin(45)).toBe('45m');
  });

  it('59 → "59m"', () => {
    expect(formatarTempoMin(59)).toBe('59m');
  });

  // ── Horas exatas e com minutos ────────────────────────────────────────────
  it('60 → "1h"', () => {
    expect(formatarTempoMin(60)).toBe('1h');
  });

  it('90 → "1h 30m"', () => {
    expect(formatarTempoMin(90)).toBe('1h 30m');
  });

  it('120 → "2h"', () => {
    expect(formatarTempoMin(120)).toBe('2h');
  });

  it('1439 → "23h 59m"', () => {
    expect(formatarTempoMin(1439)).toBe('23h 59m');
  });

  // ── Dias ──────────────────────────────────────────────────────────────────
  it('1440 → "1d"', () => {
    expect(formatarTempoMin(1440)).toBe('1d');
  });

  it('1500 → "1d 1h"', () => {
    expect(formatarTempoMin(1500)).toBe('1d 1h');
  });

  it('2880 → "2d"', () => {
    expect(formatarTempoMin(2880)).toBe('2d');
  });

  it('2940 → "2d 1h"', () => {
    expect(formatarTempoMin(2940)).toBe('2d 1h');
  });

  // ── Robustez ──────────────────────────────────────────────────────────────
  it('valor negativo não lança exceção', () => {
    expect(() => formatarTempoMin(-1)).not.toThrow();
  });
});

describe('SEVERIDADE_SLA_INT', () => {
  it('vencido > critico > atencao > ok > sem_prazo > encerrado', () => {
    const s = SEVERIDADE_SLA_INT;
    expect(s.vencido).toBeGreaterThan(s.critico);
    expect(s.critico).toBeGreaterThan(s.atencao);
    expect(s.atencao).toBeGreaterThan(s.ok);
    expect(s.ok).toBeGreaterThan(s.sem_prazo);
    expect(s.sem_prazo).toBeGreaterThan(s.encerrado);
  });

  it('cobre exatamente os 6 status de SlaInteligenteStatus', () => {
    expect(Object.keys(SEVERIDADE_SLA_INT)).toHaveLength(6);
  });

  it('todos os valores são números inteiros não-negativos', () => {
    for (const v of Object.values(SEVERIDADE_SLA_INT)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
