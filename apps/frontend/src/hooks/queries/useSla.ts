import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export const useSlaByCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['sla', clienteId],
    queryFn: () => api.sla.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.RECENT,
  });
};

export const useSlaPendingCount = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['sla_pending_count', clienteId],
    queryFn: () => api.sla.pendingCount(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.RECENT,
  });
};

/** Role-aware SLA list for the Agente panel (includes agente join + server-side client filter). */
export const useAgenteSlas = (clienteId: string | null, agenteId?: string | null) => {
  return useQuery({
    queryKey: ['sla_panel', clienteId, agenteId ?? null],
    queryFn: () => api.sla.listForPanel(clienteId!, agenteId ?? undefined),
    enabled: !!clienteId,
    staleTime: STALE.VERY_SHORT,
    refetchInterval: STALE.VERY_SHORT,
  });
};
