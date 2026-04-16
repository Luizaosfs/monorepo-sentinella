import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

/**
 * Trilha de auditoria de status_atendimento de um levantamento_item.
 * Retorna do mais recente ao mais antigo.
 * Usado na timeline do ItemDetailPanel (Sprint 3).
 */
export function useItemStatusHistorico(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['item_status_historico', itemId],
    queryFn: () => api.itens.listStatusHistorico(itemId!),
    enabled: !!itemId,
    staleTime: 30 * 1000, // 30s — muda quando operador salva status
  });
}
