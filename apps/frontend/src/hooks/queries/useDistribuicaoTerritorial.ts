import { useQuery } from '@tanstack/react-query';

import { STALE } from '@/lib/queryConfig';
import { api } from '@/services/api';
import type { DistribuicaoTerritorialItem } from '@/services/api/domains/quarteiroes';

export type { DistribuicaoTerritorialItem };

/**
 * Distribuição territorial atual — registro mais recente por quadra, sem dependência de ciclo.
 * Fase B1: leitura paralela para validação do modelo territorial fixo.
 */
export function useDistribuicaoTerritorial(
  clienteId: string | null | undefined,
  agenteId?: string | null,
  bairroId?: string | null,
) {
  return useQuery<DistribuicaoTerritorialItem[]>({
    queryKey: [
      'distribuicao_territorial',
      clienteId,
      agenteId ?? null,
      bairroId ?? null,
    ],
    queryFn: () =>
      api.distribuicaoQuarteirao.listTerritorial(
        clienteId!,
        agenteId ?? undefined,
        bairroId ?? undefined,
      ),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}
