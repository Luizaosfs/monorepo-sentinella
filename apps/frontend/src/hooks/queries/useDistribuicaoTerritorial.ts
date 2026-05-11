import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { STALE } from '@/lib/queryConfig';
import { api } from '@/services/api';
import type { DistribuicaoTerritorialItem } from '@/services/api/domains/quarteiroes';

export type { DistribuicaoTerritorialItem };

const QUERY_KEY = 'distribuicao_territorial';

export function useDistribuicaoTerritorial(
  clienteId: string | null | undefined,
  agenteId?: string | null,
  bairroId?: string | null,
) {
  return useQuery<DistribuicaoTerritorialItem[]>({
    queryKey: [QUERY_KEY, clienteId, agenteId ?? null, bairroId ?? null],
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

export function useAtribuirQuadraTerritorial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quadraId, agenteId }: { quadraId: string; agenteId: string }) =>
      api.distribuicaoQuarteirao.atribuirTerritorial(quadraId, agenteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDesatribuirQuadraTerritorial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quadraId: string) =>
      api.distribuicaoQuarteirao.desatribuirTerritorial(quadraId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
