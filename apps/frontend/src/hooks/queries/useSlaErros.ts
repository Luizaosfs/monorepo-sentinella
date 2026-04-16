import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export interface SlaErroCriacao {
  id: string;
  cliente_id: string | null;
  item_id: string | null;
  levantamento_item_id: string | null;
  erro: string | null;
  contexto: Record<string, unknown> | null;
  created_at: string;
}

export function useSlaErros(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['sla-erros-criacao', clienteId],
    queryFn: () => api.slaErros.listByCliente(clienteId!) as Promise<SlaErroCriacao[]>,
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}
