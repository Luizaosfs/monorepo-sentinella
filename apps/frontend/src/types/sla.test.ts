import { describe, it, expect } from 'vitest';
import { calcularSlaHoras, SLA_RULES } from './sla';
import type { SlaConfigJson } from './sla-config';

describe('calcularSlaHoras', () => {
  // ── Base hours per priority ──────────────────────────────────────────────

  it('returns 4h base for Crítica', () => {
    expect(calcularSlaHoras('Crítica')).toBe(4);
  });

  it('returns 4h base for Urgente', () => {
    expect(calcularSlaHoras('Urgente')).toBe(4);
  });

  it('returns 12h base for Alta', () => {
    expect(calcularSlaHoras('Alta')).toBe(12);
  });

  it('returns 24h base for Moderada', () => {
    expect(calcularSlaHoras('Moderada')).toBe(24);
  });

  it('returns 24h base for Média', () => {
    expect(calcularSlaHoras('Média')).toBe(24);
  });

  it('returns 72h base for Baixa', () => {
    expect(calcularSlaHoras('Baixa')).toBe(72);
  });

  it('returns 72h base for Monitoramento', () => {
    expect(calcularSlaHoras('Monitoramento')).toBe(72);
  });

  it('falls back to Baixa (72h) for unknown priority', () => {
    expect(calcularSlaHoras('Desconhecida')).toBe(72);
  });

  // ── Reductions ───────────────────────────────────────────────────────────

  it('reduces 30% when classificacaoRisco is "Muito Alto"', () => {
    // 24h * 0.7 = 16.8 → rounds to 17
    expect(calcularSlaHoras('Moderada', 'Muito Alto')).toBe(17);
  });

  it('is case-insensitive for classificacaoRisco "muito alto"', () => {
    expect(calcularSlaHoras('Moderada', 'muito alto')).toBe(17);
  });

  it('is case-insensitive for classificacaoRisco "MUITO ALTO"', () => {
    expect(calcularSlaHoras('Moderada', 'MUITO ALTO')).toBe(17);
  });

  it('does NOT reduce for other classificacaoRisco values', () => {
    expect(calcularSlaHoras('Moderada', 'Alto')).toBe(24);
    expect(calcularSlaHoras('Moderada', 'Médio')).toBe(24);
    expect(calcularSlaHoras('Moderada', 'Baixo')).toBe(24);
  });

  it('reduces 20% when persistencia7d > 3', () => {
    // 24h * 0.8 = 19.2 → rounds to 19
    expect(calcularSlaHoras('Moderada', null, '4')).toBe(19);
    expect(calcularSlaHoras('Moderada', null, '7')).toBe(19);
  });

  it('does NOT reduce for persistencia7d <= 3', () => {
    expect(calcularSlaHoras('Moderada', null, '3')).toBe(24);
    expect(calcularSlaHoras('Moderada', null, '0')).toBe(24);
    expect(calcularSlaHoras('Moderada', null, '1')).toBe(24);
  });

  it('does NOT reduce for null persistencia7d', () => {
    expect(calcularSlaHoras('Moderada', null, null)).toBe(24);
  });

  it('reduces 10% when tempMediaC > 30', () => {
    // 24h * 0.9 = 21.6 → rounds to 22
    expect(calcularSlaHoras('Moderada', null, null, 31)).toBe(22);
    expect(calcularSlaHoras('Moderada', null, null, 35)).toBe(22);
  });

  it('does NOT reduce for tempMediaC <= 30', () => {
    expect(calcularSlaHoras('Moderada', null, null, 30)).toBe(24);
    expect(calcularSlaHoras('Moderada', null, null, 25)).toBe(24);
    expect(calcularSlaHoras('Moderada', null, null, 0)).toBe(24);
  });

  it('does NOT reduce for null tempMediaC', () => {
    expect(calcularSlaHoras('Moderada', null, null, null)).toBe(24);
  });

  // ── Combinations ─────────────────────────────────────────────────────────

  it('applies all three reductions together for Moderada', () => {
    // 24 * 0.7 * 0.8 * 0.9 = 12.096 → rounds to 12
    expect(calcularSlaHoras('Moderada', 'Muito Alto', '5', 32)).toBe(12);
  });

  it('applies all three reductions together for Baixa', () => {
    // 72 * 0.7 * 0.8 * 0.9 = 36.288 → rounds to 36
    expect(calcularSlaHoras('Baixa', 'Muito Alto', '5', 32)).toBe(36);
  });

  it('applies all three reductions for Alta', () => {
    // 12 * 0.7 * 0.8 * 0.9 = 6.048 → rounds to 6
    expect(calcularSlaHoras('Alta', 'Muito Alto', '5', 32)).toBe(6);
  });

  // ── Minimum 2h enforcement ───────────────────────────────────────────────

  it('enforces minimum 2h for Crítica with all reductions', () => {
    // 4 * 0.7 * 0.8 * 0.9 = 2.016 → rounds to 2 → max(2, 2) = 2
    expect(calcularSlaHoras('Crítica', 'Muito Alto', '5', 32)).toBe(2);
  });

  it('enforces minimum 2h for Urgente with all reductions', () => {
    // 4 * 0.7 * 0.8 * 0.9 = 2.016 → rounds to 2
    expect(calcularSlaHoras('Urgente', 'Muito Alto', '5', 32)).toBe(2);
  });

  it('never returns less than 2', () => {
    // Hypothetically, even a custom rule with very small base should not go below 2
    const result = calcularSlaHoras('Crítica', 'Muito Alto', '5', 32);
    expect(result).toBeGreaterThanOrEqual(2);
  });

  // ── SLA_RULES constant integrity ─────────────────────────────────────────

  it('SLA_RULES covers all expected priorities', () => {
    const expectedPriorities = ['Crítica', 'Urgente', 'Alta', 'Moderada', 'Média', 'Baixa', 'Monitoramento'];
    for (const p of expectedPriorities) {
      expect(SLA_RULES).toHaveProperty(p);
    }
  });

  it('SLA_RULES has positive horas for all priorities', () => {
    for (const rule of Object.values(SLA_RULES)) {
      expect(rule.horas).toBeGreaterThan(0);
    }
  });

  // ── Custom config parameter ───────────────────────────────────────────────

  it('uses custom config when provided', () => {
    const customConfig: SlaConfigJson = {
      prioridades: {
        'Alta': { horas: 8, criticidade: 'Alta' },
        'Baixa': { horas: 48, criticidade: 'Baixa' },
      },
      fatores: {
        risco_muito_alto_pct: 50,
        persistencia_dias_min: 2,
        persistencia_pct: 25,
        temperatura_min: 28,
        temperatura_pct: 15,
      },
      horario_comercial: { ativo: false, inicio: '08:00', fim: '18:00', dias_semana: [1,2,3,4,5] },
    };
    // 8h base (custom Alta)
    expect(calcularSlaHoras('Alta', null, null, null, customConfig)).toBe(8);
  });

  it('custom config: applies custom risco_muito_alto_pct (50%)', () => {
    const customConfig: SlaConfigJson = {
      prioridades: { 'Alta': { horas: 8, criticidade: 'Alta' }, 'Baixa': { horas: 48, criticidade: 'Baixa' } },
      fatores: { risco_muito_alto_pct: 50, persistencia_dias_min: 2, persistencia_pct: 25, temperatura_min: 28, temperatura_pct: 15 },
      horario_comercial: { ativo: false, inicio: '08:00', fim: '18:00', dias_semana: [1,2,3,4,5] },
    };
    // 8 * 0.5 = 4
    expect(calcularSlaHoras('Alta', 'Muito Alto', null, null, customConfig)).toBe(4);
  });

  it('custom config: applies custom persistencia threshold (>2)', () => {
    const customConfig: SlaConfigJson = {
      prioridades: { 'Alta': { horas: 8, criticidade: 'Alta' }, 'Baixa': { horas: 48, criticidade: 'Baixa' } },
      fatores: { risco_muito_alto_pct: 50, persistencia_dias_min: 2, persistencia_pct: 25, temperatura_min: 28, temperatura_pct: 15 },
      horario_comercial: { ativo: false, inicio: '08:00', fim: '18:00', dias_semana: [1,2,3,4,5] },
    };
    // persistencia_dias_min=2, so '3' triggers reduction: 8 * 0.75 = 6
    expect(calcularSlaHoras('Alta', null, '3', null, customConfig)).toBe(6);
    // '2' does NOT trigger (must be > 2): 8
    expect(calcularSlaHoras('Alta', null, '2', null, customConfig)).toBe(8);
  });

  it('custom config: falls back to Baixa when priority not in custom prioridades', () => {
    const customConfig: SlaConfigJson = {
      prioridades: { 'Baixa': { horas: 48, criticidade: 'Baixa' } },
      fatores: { risco_muito_alto_pct: 30, persistencia_dias_min: 3, persistencia_pct: 20, temperatura_min: 30, temperatura_pct: 10 },
      horario_comercial: { ativo: false, inicio: '08:00', fim: '18:00', dias_semana: [1,2,3,4,5] },
    };
    // 'Alta' not in prioridades → falls back to 'Baixa' → 48h
    expect(calcularSlaHoras('Alta', null, null, null, customConfig)).toBe(48);
  });

  it('without config param, behaves same as DEFAULT_SLA_CONFIG (backward compat)', () => {
    // All existing tests implicitly verify this; one explicit check
    // Moderada 24h, no reductions → 24
    expect(calcularSlaHoras('Moderada')).toBe(24);
  });
});
