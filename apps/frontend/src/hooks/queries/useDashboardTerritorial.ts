import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import type { DashboardTerritorialParams, DashboardTerritorialResponse } from '@/types/dashboardTerritorial';

export function useDashboardTerritorial(params: DashboardTerritorialParams = {}) {
  const { clienteId } = useClienteAtivo();

  return useQuery<DashboardTerritorialResponse>({
    queryKey: ['dashboard-territorial', clienteId, params],
    queryFn: () => api.territorial.getTerritorial(params),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}
