import { useState, useEffect, useCallback } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const supported = typeof Notification !== 'undefined';

  useEffect(() => {
    if (supported) {
      setPermission(Notification.permission);
    }
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) return 'denied' as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [supported]);

  return { permission, supported, requestPermission };
}

/** Fire a browser notification (no-op if permission not granted) */
export function sendBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      ...options,
    });
    // Auto-close after 8s
    setTimeout(() => n.close(), 8000);
  } catch {
    // Silent — SW context may differ
  }
}
