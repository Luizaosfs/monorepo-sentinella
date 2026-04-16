import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useSlaConfigRegiao(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['sla_config_regiao', clienteId],
    queryFn: () => api.slaConfigRegiao.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
}

export function useSlaConfigRegiaoMutations(clienteId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['sla_config_regiao', clienteId] });

  const upsert = useMutation({
    mutationFn: ({ regiaoId, config }: { regiaoId: string; config: Record<string, unknown> }) =>
      api.slaConfigRegiao.upsert(clienteId, regiaoId, config),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.slaConfigRegiao.remove(id),
    onSuccess: invalidate,
  });

  return { upsert, remove };
}
