import { normalizarQuarteirao } from '../normalizar-quarteirao';

describe('normalizarQuarteirao', () => {
  it('undefined → null', () => {
    expect(normalizarQuarteirao(undefined)).toBeNull();
  });

  it('null → null', () => {
    expect(normalizarQuarteirao(null)).toBeNull();
  });

  it('"" → null', () => {
    expect(normalizarQuarteirao('')).toBeNull();
  });

  it('"  " (só espaços) → null', () => {
    expect(normalizarQuarteirao('  ')).toBeNull();
  });

  it('"Q1" → "Q1"', () => {
    expect(normalizarQuarteirao('Q1')).toBe('Q1');
  });

  it('"  Q1  " → "Q1" (trim)', () => {
    expect(normalizarQuarteirao('  Q1  ')).toBe('Q1');
  });

  it('"0010" → "0010" (preserva zeros à esquerda)', () => {
    expect(normalizarQuarteirao('0010')).toBe('0010');
  });
});
