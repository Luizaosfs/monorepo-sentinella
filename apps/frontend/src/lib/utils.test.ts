import { describe, it, expect } from 'vitest';
import { cn, getErrorMessage } from './utils';

describe('cn', () => {
  it('mescla classes Tailwind sem conflito (twMerge)', () => {
    expect(cn('p-4', 'p-2')).toMatch(/p-2/);
  });

  it('aceita condicionais falsas', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('getErrorMessage', () => {
  it('extrai Error', () => {
    expect(getErrorMessage(new Error('x'))).toBe('x');
  });

  it('retorna string direta', () => {
    expect(getErrorMessage('falha')).toBe('falha');
  });

  it('usa fallback', () => {
    expect(getErrorMessage(null)).toBe('Erro ao importar JSON');
    expect(getErrorMessage(123, 'outro')).toBe('outro');
  });
});
