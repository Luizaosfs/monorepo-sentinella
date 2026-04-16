import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOfflineStatus } from './useOfflineStatus';

describe('useOfflineStatus', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('reflete navigator.onLine inicial', async () => {
    const { result } = renderHook(() => useOfflineStatus());
    await waitFor(() => {
      expect(result.current.isOnline).toBe(navigator.onLine);
    });
  });

  it('atualiza para offline e online com eventos', async () => {
    const { result } = renderHook(() => useOfflineStatus());
    await waitFor(() => expect(result.current.isOnline).toBe(navigator.onLine));

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    await waitFor(() => expect(result.current.isOnline).toBe(false));

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
      expect(result.current.lastOnlineAt).toBeInstanceOf(Date);
    });
  });
});
