import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE, GC } from '@/lib/queryConfig';

/** Itens do operador em campo.
 *  gcTime estendido: dados permanecem em cache 30 min após desmonte —
 *  operador pode perder sinal e navegar entre telas sem perder os dados. */
export const useItensOperador = (clienteId: string | null, usuarioId: string | null) => {
  return useQuery({
    queryKey: ['itens_operador', clienteId, usuarioId],
    queryFn: () => api.itens.listByOperador(clienteId!, usuarioId!),
    enabled: !!clienteId && !!usuarioId,
    staleTime: STALE.MEDIUM,
    gcTime: GC.EXTENDED,
  });
};
