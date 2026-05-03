import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { DashboardTerritorialParams, DashboardTerritorialResponse } from '@/types/dashboardTerritorial';

export function useDashboardTerritorial(params: DashboardTerritorialParams = {}) {
  return useQuery<DashboardTerritorialResponse>({
    queryKey: ['dashboard-territorial', params],
    queryFn: () => api.territorial.getTerritorial(params),
    staleTime: STALE.SHORT,
  });
}
