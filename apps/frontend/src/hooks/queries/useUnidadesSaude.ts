import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { UnidadeSaude } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

export function useUnidadesSaude(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['unidades_saude', clienteId],
    queryFn: () => api.unidadesSaude.list(clienteId!),
    enabled: !!clienteId,
    // SHORT (1 min): gateia a criação de notificador e é editado em outra tela
    // (AdminUnidadesSaude). 10 min de stale escondia UBS recém-criada entre
    // abas/sessões distintas (admin cria, supervisor não via).
    staleTime: STALE.SHORT,
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
