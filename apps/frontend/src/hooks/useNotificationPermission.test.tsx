import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNotificationPermission, sendBrowserNotification } from './useNotificationPermission';

describe('useNotificationPermission', () => {
  const OrigNotification = globalThis.Notification;

  afterEach(() => {
    globalThis.Notification = OrigNotification;
    vi.restoreAllMocks();
  });

  it('supported false quando Notification não existe', () => {
    // @ts-expect-error test
    delete globalThis.Notification;
    const { result } = renderHook(() => useNotificationPermission());
    expect(result.current.supported).toBe(false);
    expect(result.current.permission).toBe('denied');
  });

  it('requestPermission retorna denied quando não suportado', async () => {
    // @ts-expect-error test
    delete globalThis.Notification;
    const { result } = renderHook(() => useNotificationPermission());
    let r: NotificationPermission = 'granted';
    await act(async () => {
      r = await result.current.requestPermission();
    });
    expect(r).toBe('denied');
  });

  it('requestPermission chama Notification.requestPermission', async () => {
    const req = vi.fn().mockResolvedValue('granted' as NotificationPermission);
    globalThis.Notification = class {
      static permission: NotificationPermission = 'default';
      static requestPermission = req;
    } as unknown as typeof Notification;

    const { result } = renderHook(() => useNotificationPermission());
    let out: NotificationPermission = 'denied';
    await act(async () => {
      out = await result.current.requestPermission();
    });
    expect(req).toHaveBeenCalled();
    expect(out).toBe('granted');
    expect(result.current.permission).toBe('granted');
  });
});

describe('sendBrowserNotification', () => {
  const OrigNotification = globalThis.Notification;

  afterEach(() => {
    globalThis.Notification = OrigNotification;
    vi.restoreAllMocks();
  });

  it('não instancia quando permission !== granted', () => {
    const ctor = vi.fn();
    globalThis.Notification = class {
      static permission: NotificationPermission = 'default';
      constructor() {
        ctor();
      }
    } as unknown as typeof Notification;

    sendBrowserNotification('t');
    expect(ctor).not.toHaveBeenCalled();
  });

  it('cria notificação e agenda close quando granted', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    globalThis.Notification = class {
      static permission: NotificationPermission = 'granted';
      constructor(_title: string, _opts?: NotificationOptions) {
        return { close } as unknown as Notification;
      }
    } as unknown as typeof Notification;

    sendBrowserNotification('Olá', { body: 'b' });
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(8000);
    expect(close).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('engole erro do construtor', () => {
    globalThis.Notification = class {
      static permission: NotificationPermission = 'granted';
      constructor() {
        throw new Error('fail');
      }
    } as unknown as typeof Notification;

    expect(() => sendBrowserNotification('x')).not.toThrow();
  });
});
