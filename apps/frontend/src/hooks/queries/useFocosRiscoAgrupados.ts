import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { FocoRiscoAgrupado } from '@/types/database';

/**
 * Agrupamento territorial de focos ativos.
 * Fonte: view v_focos_risco_agrupados (hierarquia: quadra > bairro > regiao > item).
 */
export function useFocosRiscoAgrupados(clienteId: string | null | undefined) {
  return useQuery<FocoRiscoAgrupado[]>({
    queryKey: ['focos_risco_agrupados', clienteId],
    queryFn:  () => api.focosRisco.agrupados(clienteId!),
    enabled:  !!clienteId,
    staleTime: STALE.SHORT,
  });
}
