import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { FocoRiscoAtivo } from '@/types/database';

/**
 * Focos ativos atribuídos ao agente logado: todos os status não-terminais.
 * Inclui aguarda_inspecao, em_inspecao, confirmado e em_tratamento para que
 * o foco não desapareça da visão do agente ao avançar no fluxo.
 */
export function useFocosAtribuidos(
  clienteId: string | null | undefined,
  responsavelId: string | null | undefined,
): { data: FocoRiscoAtivo[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['focos_atribuidos', clienteId, responsavelId],
    queryFn: async () => {
      const result = await api.focosRisco.list(clienteId!, {
        status: ['aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'],
        responsavel_id: responsavelId!,
        pageSize: 50,
      });
      return result.data;
    },
    enabled: !!clienteId && !!responsavelId,
    staleTime: STALE.SHORT,
  });

  // Guard: if cache was poisoned with {data,count} shape, normalise to array
  const safe = Array.isArray(data) ? data : [];
  return { data: safe, isLoading };
}
