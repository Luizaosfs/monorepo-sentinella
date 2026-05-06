import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { FocoRiscoAtivo } from '@/types/database';

/**
 * Focos ativos atribuídos ao agente logado para trabalho operacional em campo.
 * Inclui aguardando_nova_tentativa para tentativa 1/2 sem acesso, mas exclui
 * focos escalados ao supervisor (pendente_decisao_supervisor=true).
 */
export function useFocosAtribuidos(
  clienteId: string | null | undefined,
  responsavelId: string | null | undefined,
): { data: FocoRiscoAtivo[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['focos_atribuidos', clienteId, responsavelId],
    queryFn: async () => {
      const result = await api.focosRisco.list(clienteId!, {
        status: ['aguarda_inspecao', 'em_inspecao', 'aguardando_nova_tentativa', 'confirmado', 'em_tratamento'],
        responsavel_id: responsavelId!,
        pageSize: 50,
      });
      // Regra: foco escalado ao supervisor sai da mão do agente.
      return result.data.filter((foco) => !foco.pendente_decisao_supervisor);
    },
    enabled: !!clienteId && !!responsavelId,
    staleTime: STALE.SHORT,
  });

  // Guard: if cache was poisoned with {data,count} shape, normalise to array
  const safe = Array.isArray(data) ? data : [];
  return { data: safe, isLoading };
}
