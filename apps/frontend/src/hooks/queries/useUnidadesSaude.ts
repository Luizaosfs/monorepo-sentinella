import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { UnidadeSaude } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

export function useUnidadesSaude(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['unidades_saude', clienteId],
    queryFn: () => api.unidadesSaude.list(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG, // 10 min — cadastro estável
  });
}

export function useCreateUnidadeSaudeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.unidadesSaude.create,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['unidades_saude', variables.cliente_id] });
    },
  });
}

export function useUpdateUnidadeSaudeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UnidadeSaude> }) =>
      api.unidadesSaude.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unidades_saude'] });
    },
  });
}
