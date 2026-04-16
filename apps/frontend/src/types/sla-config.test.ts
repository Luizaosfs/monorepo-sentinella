import { describe, it, expect } from 'vitest';
import { DEFAULT_SLA_CONFIG, type SlaConfigJson } from './sla-config';

describe('DEFAULT_SLA_CONFIG', () => {
  it('é um SlaConfigJson válido com prioridades e fatores', () => {
    const c: SlaConfigJson = DEFAULT_SLA_CONFIG;
    expect(c.prioridades['Crítica'].horas).toBe(4);
    expect(c.prioridades['Alta'].horas).toBe(12);
    expect(c.fatores.risco_muito_alto_pct).toBe(30);
    expect(c.horario_comercial.ativo).toBe(false);
    expect(c.horario_comercial.dias_semana).toEqual([1, 2, 3, 4, 5]);
  });
});
