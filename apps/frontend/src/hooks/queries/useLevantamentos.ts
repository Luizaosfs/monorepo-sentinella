import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export const useLevantamentos = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['levantamentos', clienteId],
    queryFn: () => api.levantamentos.list(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
};
