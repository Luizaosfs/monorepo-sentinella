import { useQuery } from '@tanstack/react-query';

import { STALE, GC } from '@/lib/queryConfig';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import type { TerritorioAgenteVM } from '@/services/api/domains/quarteiroes';

export type { TerritorioAgenteVM };

const QUERY_KEY = 'territorio_agente';

/**
 * Território fixo do agente autenticado — quadras permanentes via distribuição territorial
 * (ciclo_id = NULL). Funciona sem ciclo ativo.
 *
 * gcTime estendido: dados permanecem em cache 30 min após desmonte para suporte offline.
 * Não depende de cicloId — território não some ao abrir novo ciclo sem cópia.
 */
export function useTerritorioAgente() {
  const { clienteId } = useClienteAtivo();
  return useQuery<TerritorioAgenteVM>({
    queryKey: [QUERY_KEY, clienteId],
    queryFn: () => api.distribuicaoQuarteirao.getMeuTerritorio(),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
    gcTime: GC.EXTENDED,
  });
}
