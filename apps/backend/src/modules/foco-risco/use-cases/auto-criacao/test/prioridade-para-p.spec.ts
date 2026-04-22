import { prioridadeParaP } from '../prioridade-para-p';

describe('prioridadeParaP', () => {
  describe('passa P1-P5 inalterados', () => {
    it.each(['P1', 'P2', 'P3', 'P4', 'P5'] as const)('%s', (p) => {
      expect(prioridadeParaP(p)).toBe(p);
    });
  });

  describe('legado em português → P1', () => {
    it.each(['Crítico', 'CRITICO', 'crítica', 'CRITICA', 'Urgente'])('%s → P1', (v) => {
      expect(prioridadeParaP(v)).toBe('P1');
    });
  });

  it('Alta → P2', () => {
    expect(prioridadeParaP('Alta')).toBe('P2');
    expect(prioridadeParaP('ALTA')).toBe('P2');
  });

  describe('legado → P3', () => {
    it.each(['Média', 'MEDIA', 'Moderada', 'MODERADO'])('%s → P3', (v) => {
      expect(prioridadeParaP(v)).toBe('P3');
    });
  });

  it('Baixa → P4', () => {
    expect(prioridadeParaP('Baixa')).toBe('P4');
  });

  it('Monitoramento → P5', () => {
    expect(prioridadeParaP('Monitoramento')).toBe('P5');
  });

  describe('fallback P3 para entradas desconhecidas', () => {
    it.each([null, undefined, '', '   ', 'foo', 'bar'])('%p → P3', (v) => {
      expect(prioridadeParaP(v as unknown as string)).toBe('P3');
    });
  });

  it('é case-insensitive', () => {
    expect(prioridadeParaP('crítica')).toBe('P1');
    expect(prioridadeParaP('CRÍTICA')).toBe('P1');
    expect(prioridadeParaP('Crítica')).toBe('P1');
  });

  it('faz trim antes de avaliar', () => {
    expect(prioridadeParaP(' P1 ')).toBe('P1');
    expect(prioridadeParaP('\tURGENTE\n')).toBe('P1');
  });
});
