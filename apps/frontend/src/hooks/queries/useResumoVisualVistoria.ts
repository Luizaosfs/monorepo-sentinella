import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { ResumoVisualVistoriaResponse } from '@/types/resumoVistoria';

export function useResumoVisualVistoria(focoId: string | undefined) {
  return useQuery<ResumoVisualVistoriaResponse>({
    queryKey: ['resumo-visual-vistoria', focoId],
    queryFn: () => api.focosRisco.getResumoVistoria(focoId!),
    enabled: !!focoId,
    staleTime: STALE.SHORT,
  });
}
