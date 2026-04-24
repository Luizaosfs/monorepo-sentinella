import { elevarPrioridadeRecorrencia } from '../helpers/elevar-prioridade-recorrencia';

describe('elevarPrioridadeRecorrencia', () => {
  it('P5 → P4', () => expect(elevarPrioridadeRecorrencia('P5')).toBe('P4'));
  it('P4 → P3', () => expect(elevarPrioridadeRecorrencia('P4')).toBe('P3'));
  it('P3 → P2', () => expect(elevarPrioridadeRecorrencia('P3')).toBe('P2'));
  it('P2 → P1', () => expect(elevarPrioridadeRecorrencia('P2')).toBe('P1'));
  it('P1 permanece P1 (teto)', () => expect(elevarPrioridadeRecorrencia('P1')).toBe('P1'));
  it('null → baseline P3 → P2', () => expect(elevarPrioridadeRecorrencia(null)).toBe('P2'));
  it('undefined → baseline P3 → P2', () => expect(elevarPrioridadeRecorrencia(undefined)).toBe('P2'));
});
