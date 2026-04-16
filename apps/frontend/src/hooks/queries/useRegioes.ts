import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useRegioes(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['regioes', clienteId],
    queryFn: () => api.regioes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });
}
