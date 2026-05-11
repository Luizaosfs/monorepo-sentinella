import { useQuery } from '@tanstack/react-query';

import { STALE, GC } from '@/lib/queryConfig';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useTerritorioAgente } from '@/hooks/queries/useTerritorioAgente';

const QUERY_KEY = 'imoveis_territorio';

/**
 * Imóveis filtrados pelas quadras do território permanente do agente (ciclo_id IS NULL).
 * Aguarda o território carregar antes de buscar — sem território, retorna lista vazia.
 * gcTime estendido para suporte offline (30 min após desmonte).
 */
export function useImoveisTerritorio() {
  const { clienteId } = useClienteAtivo();
  const { data: territorio, isLoading: loadingTerritorio } = useTerritorioAgente();

  const quadraIds = territorio?.quadras.map((q) => q.quadraId) ?? [];
  const hasTerritory = !loadingTerritorio && quadraIds.length > 0;

  return useQuery({
    queryKey: [QUERY_KEY, clienteId, quadraIds],
    queryFn: () => api.imoveis.listResumo(clienteId!, undefined, quadraIds),
    enabled: !!clienteId && hasTerritory,
    staleTime: STALE.MEDIUM,
    gcTime: GC.EXTENDED,
    placeholderData: [],
  });
}
