/**
 * SyncStatusPanel — painel de sincronização offline para o agente.
 *
 * Mostra:
 *  - Contagem de operações pendentes na fila IndexedDB
 *  - Operações com falha (retryCount > 0) e motivo
 *  - Operações aguardando backoff (nextRetryAt no futuro)
 *  - Botão "Retentar agora" para acionar drainQueue manualmente
 *
 * Uso:
 *   <SyncStatusPanel />   — exibe apenas se houver pendências
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listAll, drainQueue, QueuedOperation } from '@/lib/offlineQueue';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { toast } from 'sonner';

interface QueueStats {
  total: number;
  aguardandoBackoff: number;
  comFalha: number;
  ops: QueuedOperation[];
}

const LABEL: Record<string, string> = {
  checkin:            'Check-in',
  update_atendimento: 'Atendimento',
  save_vistoria:      'Vistoria',
};

function calcStats(ops: QueuedOperation[]): QueueStats {
  const now = Date.now();
  const comFalha = ops.filter((o) => (o.retryCount ?? 0) > 0);
  const aguardandoBackoff = ops.filter((o) => o.nextRetryAt && o.nextRetryAt > now);
  return {
    total: ops.length,
    comFalha: comFalha.length,
    aguardandoBackoff: aguardandoBackoff.length,
    ops,
  };
}

export function SyncStatusPanel() {
  const isOffline = useOfflineStatus();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    const ops = await listAll();
    setStats(calcStats(ops));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Não renderiza se fila vazia
  if (!stats || stats.total === 0) return null;

  async function handleRetentar() {
    setRetrying(true);
    try {
      const result = await drainQueue();
      if (result.ok > 0) {
        toast.success(`${result.ok} operação(ões) sincronizada(s) com sucesso.`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} operação(ões) ainda com falha. Tente novamente mais tarde.`);
      }
    } catch {
      toast.error('Erro ao tentar sincronizar. Verifique sua conexão.');
    } finally {
      setRetrying(false);
      await refresh();
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            {stats.total} operação(ões) pendente(s) de envio
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
          onClick={handleRetentar}
          disabled={retrying || isOffline}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Enviando…' : 'Retentar agora'}
        </Button>
      </div>

      {isOffline && (
        <p className="text-xs text-amber-700">
          Você está offline. As operações serão enviadas ao reconectar.
        </p>
      )}

      {/* Lista de operações */}
      <div className="space-y-1.5">
        {stats.ops.map((op) => {
          const retryCount = op.retryCount ?? 0;
          const aguardando = op.nextRetryAt && op.nextRetryAt > Date.now();
          const imovelId = op.type === 'save_vistoria' ? op.payload.imovelId : null;

          return (
            <div
              key={op.id}
              className="flex items-center justify-between rounded bg-white/70 px-3 py-1.5 text-xs border border-amber-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                {aguardando ? (
                  <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                ) : retryCount > 0 ? (
                  <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-amber-400 shrink-0" />
                )}
                <span className="font-medium text-gray-700">{LABEL[op.type] ?? op.type}</span>
                {imovelId && (
                  <span className="truncate text-gray-400">
                    imóvel {imovelId.slice(0, 8)}…
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {retryCount > 0 && (
                  <Badge variant="destructive" className="h-4 text-[10px] px-1">
                    {retryCount}x falhou
                  </Badge>
                )}
                {aguardando && (
                  <Badge variant="secondary" className="h-4 text-[10px] px-1">
                    aguardando
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
