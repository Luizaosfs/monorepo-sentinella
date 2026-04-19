import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE, GC } from '@/lib/queryConfig';

/** Itens do agente em campo.
 *  gcTime estendido: dados permanecem em cache 30 min após desmonte —
 *  agente pode perder sinal e navegar entre telas sem perder os dados. */
export const useItensAgente = (clienteId: string | null, usuarioId: string | null) => {
  return useQuery({
    queryKey: ['itens_agente', clienteId, usuarioId],
    queryFn: () => api.itens.listByAgente(clienteId!, usuarioId!),
    enabled: !!clienteId && !!usuarioId,
    staleTime: STALE.MEDIUM,
    gcTime: GC.EXTENDED,
  });
};
