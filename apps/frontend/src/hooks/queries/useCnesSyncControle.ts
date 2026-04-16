import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { UnidadesSaudeSyncControle } from '@/types/database';

export function useCnesSyncControle(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['cnes-sync-controle', clienteId],
    queryFn: () => api.cnesSync.listarControle(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    refetchInterval: (query) => {
      const emAndamento = (query.state.data as UnidadesSaudeSyncControle[] | undefined)?.some(
        (c) => c.status === 'em_andamento',
      );
      return emAndamento ? 5000 : false;
    },
  });
}

export function useSincronizarCnesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, usuarioId }: { clienteId: string; usuarioId?: string }) =>
      api.cnesSync.sincronizarManual(clienteId, usuarioId),
    onSuccess: (_, { clienteId }) => {
      queryClient.invalidateQueries({ queryKey: ['cnes-sync-controle', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['admin_unidades_saude', clienteId] });
    },
  });
}
