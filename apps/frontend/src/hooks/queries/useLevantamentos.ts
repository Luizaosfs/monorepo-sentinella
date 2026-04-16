import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export const useLevantamentos = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['levantamentos', clienteId],
    queryFn: () => api.levantamentos.list(clienteId!),
    enabled: !!clienteId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
