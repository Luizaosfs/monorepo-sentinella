import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useImoveisProblematicos(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['imoveis_problematicos', clienteId],
    queryFn: () => api.imoveis.listProblematicos(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}
