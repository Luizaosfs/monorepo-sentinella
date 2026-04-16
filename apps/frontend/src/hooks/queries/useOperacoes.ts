import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export const useOperacoesByCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['operacoes_stats', clienteId],
    queryFn: () => api.operacoes.statsByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.VERY_SHORT,
    refetchInterval: STALE.SHORT,
  });
};
