import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Imovel, ImovelResumo } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

export function useImoveis(clienteId: string | null | undefined, regiaoId?: string) {
  return useQuery({
    queryKey: ['imoveis', clienteId, regiaoId ?? null],
    queryFn: () => api.imoveis.list(clienteId!, regiaoId),
    enabled: !!clienteId,
    staleTime: STALE.LONG, // 10 min — cadastro estável
  });
}

export function useImoveisResumo(clienteId: string | null | undefined, regiaoId?: string) {
  return useQuery({
    queryKey: ['imoveis_resumo', clienteId, regiaoId ?? null],
    queryFn: () => api.imoveis.listResumo(clienteId!, regiaoId),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useImovelResumoById(id: string | null | undefined) {
  return useQuery({
    queryKey: ['imovel_resumo', id],
    queryFn: () => api.imoveis.getResumoById(id!),
    enabled: !!id,
    staleTime: STALE.MEDIUM,
  });
}

export function useCreateImovelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.imoveis.create,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['imoveis', variables.cliente_id] });
    },
  });
}

export function useUpdateImovelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Imovel> }) =>
      api.imoveis.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imoveis'] });
    },
  });
}
