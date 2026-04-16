import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToggle } from './useToggle';

describe('useToggle', () => {
  it('inicia com false por padrão e alterna', () => {
    const { result } = renderHook(() => useToggle());
    expect(result.current[0]).toBe(false);
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(false);
  });

  it('aceita valor inicial', () => {
    const { result } = renderHook(() => useToggle(true));
    expect(result.current[0]).toBe(true);
  });
});
