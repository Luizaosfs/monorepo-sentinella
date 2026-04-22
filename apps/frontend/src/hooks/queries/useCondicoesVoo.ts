import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { CondicaoVoo } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

/**
 * Avalia condições meteorológicas para voo de drone do cliente.
 * Refetch automático a cada 30 min; staleTime de 15 min.
 * Retorna null enquanto não há dados pluviométricos cadastrados.
 */
export function useCondicoesVoo(clienteId: string | null | undefined) {
  return useQuery<CondicaoVoo | null>({
    queryKey: ['condicoes_voo', clienteId],
    queryFn: () =>
      clienteId
        ? api.condicoesVoo.avaliarByCliente(clienteId, new Date().toISOString().slice(0, 10))
        : null,
    enabled: !!clienteId,
    staleTime: STALE.EXTENDED,
    refetchInterval: STALE.STATIC,
  });
}
