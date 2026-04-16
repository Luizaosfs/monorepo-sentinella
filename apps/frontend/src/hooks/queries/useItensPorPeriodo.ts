import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useItensPorPeriodo(
  clienteId: string | null | undefined,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: ['itens_periodo', clienteId, from, to],
    queryFn: () => api.itens.listByClienteAndPeriod(clienteId!, from, to),
    enabled: !!clienteId && !!from && !!to,
    staleTime: STALE.LONG,
  });
}
