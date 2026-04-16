import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export const usePlanejamentosAtivos = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['planejamentos', 'ativos', clienteId],
    queryFn: () => api.planejamentos.listAtivosByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
};
