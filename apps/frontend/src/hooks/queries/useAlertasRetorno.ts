import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { AlertaRetornoImovel } from '@/types/database';

export type { AlertaRetornoImovel };

/** Retorna alertas de retorno pendentes do agente (todos, não apenas vencidos). */
export function useAlertasRetorno(clienteId: string | null, agenteId: string | null) {
  return useQuery({
    queryKey: ['alertas_retorno', clienteId, agenteId],
    queryFn: () => api.alertasRetorno.listByAgente(clienteId!, agenteId!) as Promise<AlertaRetornoImovel[]>,
    enabled: !!clienteId && !!agenteId,
    staleTime: STALE.SHORT,
    refetchInterval: STALE.MODERATE,
  });
}

/** Marca alerta como resolvido. */
export function useResolverAlertaRetornoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertaId: string) => api.alertasRetorno.resolver(alertaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas_retorno'] });
    },
  });
}
