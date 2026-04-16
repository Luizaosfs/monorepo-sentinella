import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { FocoRiscoAtivo } from '@/types/database';

/**
 * Focos enriquecidos de um grupo territorial (drill-down).
 * Só busca quando `enabled` = true (expansão lazy).
 * Usa v_focos_risco_ativos — focos terminais retornam ausentes.
 */
export function useFocosDoGrupo(focoIds: string[], enabled: boolean) {
  return useQuery<FocoRiscoAtivo[]>({
    queryKey: ['focos_do_grupo', [...focoIds].sort().join(',')],
    queryFn:  () => api.focosRisco.listByIds(focoIds),
    enabled:  enabled && focoIds.length > 0,
    staleTime: STALE.SHORT,
  });
}
