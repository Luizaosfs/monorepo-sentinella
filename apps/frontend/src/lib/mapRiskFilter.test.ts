import { describe, it, expect } from 'vitest';
import { normalizeRiskBucket } from './mapRiskFilter';

describe('normalizeRiskBucket', () => {
  it('retorna indefinido para vazio', () => {
    expect(normalizeRiskBucket(null)).toBe('indefinido');
    expect(normalizeRiskBucket('')).toBe('indefinido');
  });

  it('remove acentos e reconhece crítico', () => {
    expect(normalizeRiskBucket('Crítico')).toBe('critico');
    expect(normalizeRiskBucket('critico')).toBe('critico');
  });

  it('muito alto → critico', () => {
    expect(normalizeRiskBucket('Muito Alto')).toBe('critico');
  });

  it('classifica alto, medio, baixo', () => {
    expect(normalizeRiskBucket('Alto')).toBe('alto');
    expect(normalizeRiskBucket('Médio')).toBe('medio');
    expect(normalizeRiskBucket('Baixo')).toBe('baixo');
  });

  it('texto desconhecido retorna o token normalizado', () => {
    expect(normalizeRiskBucket('xyz')).toBe('xyz');
  });
});
