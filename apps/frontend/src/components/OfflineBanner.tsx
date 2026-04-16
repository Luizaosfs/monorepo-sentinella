import { WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OfflineBannerProps {
  /** Número de operações pendentes na fila offline. */
  pendingCount?: number;
  /** true enquanto a fila está sendo drenada após reconexão. */
  isSyncing?: boolean;
}

/**
 * Banner âmbar exibido automaticamente quando o dispositivo perde a conexão.
 * Quando há operações enfileiradas, exibe o contador de pendências.
 * Quando reconecta e está sincronizando, exibe banner azul temporário.
 */
export function OfflineBanner({ pendingCount = 0, isSyncing = false }: OfflineBannerProps) {
  const { isOnline, lastOnlineAt } = useOfflineStatus();

  if (isOnline && isSyncing) {
    return (
      <div className="sticky top-0 z-50 flex items-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm font-medium shadow-md">
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
        <span className="flex-1">
          Conexão restaurada — sincronizando dados salvos offline...
          {pendingCount > 0 && (
            <span className="ml-1 font-normal opacity-80">({pendingCount} pendente{pendingCount > 1 ? 's' : ''})</span>
          )}
        </span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium shadow-md">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        Sem conexão — dados sendo salvos localmente.
        {lastOnlineAt && (
          <span className="ml-1 font-normal opacity-80">
            Última sincronização:{' '}
            {format(lastOnlineAt, "dd/MM HH:mm", { locale: ptBR })}
          </span>
        )}
      </span>
      {pendingCount > 0 && (
        <span className="shrink-0 rounded-full bg-amber-800/20 px-2 py-0.5 text-xs font-semibold">
          {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
