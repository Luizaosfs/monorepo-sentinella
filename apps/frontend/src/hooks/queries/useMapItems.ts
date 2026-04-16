import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE, GC } from '@/lib/queryConfig';

export const useMapItemsByCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['map_items', clienteId],
    queryFn: () => api.itens.listMapByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
    gcTime: GC.EXTENDED,
  });
};
