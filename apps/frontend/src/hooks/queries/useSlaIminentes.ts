import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/**
 * Lista SLAs nos últimos 20% do prazo, ordenados pelo mais urgente.
 * Usado no painel de alertas e dashboard para exibição proativa.
 */
export function useSlaIminentes(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['sla_iminentes', clienteId],
    queryFn: () => api.slaIminentes.listByCliente(clienteId!),
    enabled: !!clienteId,
    refetchInterval: STALE.SHORT, // poll a cada 1 min (mesmo ritmo do useSlaAlerts)
    staleTime: STALE.LIVE,
  });
}

/**
 * Contagem de SLAs iminentes — para badge no header/dashboard.
 */
export function useSlaIminentesCount(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['sla_iminentes_count', clienteId],
    queryFn: () => api.slaIminentes.countByCliente(clienteId!),
    enabled: !!clienteId,
    refetchInterval: STALE.SHORT,
    staleTime: STALE.LIVE,
  });
}
