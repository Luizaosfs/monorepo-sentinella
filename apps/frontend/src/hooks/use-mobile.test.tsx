import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIsMobile } from './use-mobile';

describe('useIsMobile', () => {
  const innerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: innerWidth,
    });
  });

  it('retorna true quando largura abaixo do breakpoint', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useIsMobile());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('retorna false quando largura acima ou igual ao breakpoint', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });

    const { result } = renderHook(() => useIsMobile());
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
