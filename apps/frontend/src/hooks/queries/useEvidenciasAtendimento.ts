import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { uploadImage } from '@/lib/cloudinary';
import { STALE } from '@/lib/queryConfig';

const QUERY_KEY = 'evidencias_atendimento';

export function useEvidenciasAtendimento(levantamentoItemId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, levantamentoItemId],
    queryFn: () => api.evidenciasItem.listByLevantamentoItem(levantamentoItemId!),
    enabled: !!levantamentoItemId,
    staleTime: STALE.RECENT,
  });

  const addMutation = useMutation({
    mutationFn: async ({ file, legenda }: { file: File; legenda?: string | null }) => {
      const { secure_url } = await uploadImage(file);
      return api.evidenciasItem.add(levantamentoItemId!, secure_url, legenda);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, levantamentoItemId] });
    },
  });

  return {
    evidencias: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addEvidencia: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
  };
}
