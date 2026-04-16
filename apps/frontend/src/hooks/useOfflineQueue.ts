/**
 * Gerencia a fila offline e drena automaticamente ao reconectar.
 *
 * Montar este hook uma vez na árvore (ex: AppLayout) é suficiente
 * para garantir que operações enfileiradas offline sejam sincronizadas
 * assim que a conexão for restaurada.
 */
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { listAll, drainQueue, listAllWithStatus } from '@/lib/offlineQueue';
import { invalidateAtendimentoItemCaches } from '@/lib/invalidateAtendimentoQueries';
import { toast } from 'sonner';

export function useOfflineQueue() {
  const { isOnline } = useOfflineStatus();
  const queryClient = useQueryClient();
  const { clienteId } = useClienteAtivo();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const ops = await listAllWithStatus();
      setPendingCount(ops.filter((o) => !o.expired && !o.deadLetter).length);
      setFailedCount(ops.filter((o) => o.deadLetter).length);
    } catch {
      // IndexedDB não disponível (SSR ou browser restrito)
    }
  }, []);

  // Conta inicial
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Drena ao reconectar
  useEffect(() => {
    if (!isOnline) return;
    setIsSyncing(true);
    drainQueue()
      .then(({ ok, failed, expired, touchedAtendimento, vistoriasPendentes }) => {
        // Sonner usa flushSync; disparar toast no mesmo tick que setState (invalidateQueries)
        // pode causar "Maximum update depth exceeded". Adia para após o commit.
        queueMicrotask(() => {
          if (ok > 0) toast.success(`${ok} operaç${ok === 1 ? 'ão sincronizada' : 'ões sincronizadas'} com sucesso.`);
          if (failed > 0) toast.error(`${failed} operaç${failed === 1 ? 'ão falhou' : 'ões falharam'} ao sincronizar — tentando novamente em breve.`);
          if (expired > 0) toast.warning(`${expired} operaç${expired === 1 ? 'ão descartada' : 'ões descartadas'} por expiração (mais de 7 dias na fila).`, { duration: 8000 });
          if (vistoriasPendentes > 0) {
            toast.warning(
              `${vistoriasPendentes} vistoria${vistoriasPendentes === 1 ? '' : 's'} enviada${vistoriasPendentes === 1 ? '' : 's'} sem assinatura ou foto. Complete as pendências antes de encerrar o turno.`,
              { duration: 10000 },
            );
          }
        });
        if (touchedAtendimento && clienteId) {
          invalidateAtendimentoItemCaches(queryClient, { clienteId });
        }
        // QW-05 Correção 3: atualizar listas de vistoria após drain
        queryClient.invalidateQueries({ queryKey: ['vistorias'] });
        queryClient.invalidateQueries({ queryKey: ['imoveis'] });
        queryClient.invalidateQueries({ queryKey: ['vistoria-resumo'] });
        refreshCount();
      })
      .catch(() => {
        queueMicrotask(() => toast.error('Falha ao sincronizar dados offline. Verifique a conexão e tente novamente.'));
      })
      .finally(() => setIsSyncing(false));
  }, [isOnline, refreshCount, queryClient, clienteId]);

  return { pendingCount, failedCount, isSyncing, refreshCount };
}
