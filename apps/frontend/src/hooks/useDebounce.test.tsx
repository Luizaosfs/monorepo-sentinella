import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('atualiza o valor após o delay', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebounce(v, 300),
      { initialProps: { v: 'a' } },
    );
    expect(result.current).toBe('a');

    rerender({ v: 'b' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('b');
  });

  it('cancela timeout anterior quando o valor muda rapidamente', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebounce(v, 200),
      { initialProps: { v: 'x' } },
    );

    rerender({ v: 'y' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ v: 'z' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('z');
  });
});
