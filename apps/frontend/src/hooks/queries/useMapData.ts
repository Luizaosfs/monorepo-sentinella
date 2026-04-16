import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE, GC } from '@/lib/queryConfig';

/** Bundle completo do mapa (items, áreas, planejamentos, regiões, pluvio).
 *  staleTime de 10 min — bundle pesado que não vale refetch frequente.
 *  gcTime de 30 min — mantém em memória para uso offline temporário em campo. */
export const useMapData = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['map_full_data', clienteId],
    queryFn: () => api.map.fullDataByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MAP,
    gcTime: GC.EXTENDED,
  });
};

export const useItemStatuses = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['item_statuses', clienteId],
    queryFn: () => api.map.itemStatusesByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    gcTime: GC.EXTENDED,
  });
};
