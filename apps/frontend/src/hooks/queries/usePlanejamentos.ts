import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export const usePlanejamentos = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['planejamentos', clienteId],
    queryFn: () => api.planejamentos.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
};
