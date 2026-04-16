import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useComparativoMunicipios() {
  return useQuery({
    queryKey: ['comparativo_municipios'],
    queryFn: () => api.admin.comparativoMunicipios(),
    staleTime: STALE.MODERATE,
  });
}
