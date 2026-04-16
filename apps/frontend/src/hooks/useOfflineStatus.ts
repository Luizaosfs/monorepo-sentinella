import { useState, useEffect } from 'react';

export interface OfflineStatus {
  isOnline: boolean;
  lastOnlineAt: Date | null;
}

/**
 * Monitora o status de conexão com a rede.
 * Atualiza em tempo real via eventos `online` / `offline` do navegador.
 */
export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    navigator.onLine ? new Date() : null
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, lastOnlineAt };
}
