import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { YoloFeedback } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

export function useYoloFeedback(levantamentoItemId: string | null | undefined, clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['yolo_feedback', levantamentoItemId, clienteId],
    queryFn: () => api.yoloFeedback.getByItem(levantamentoItemId!, clienteId!),
    enabled: !!levantamentoItemId && !!clienteId,
    staleTime: STALE.SHORT,
  });
}

interface FeedbackPayload {
  levantamento_item_id: string;
  cliente_id: string;
  confirmado: boolean;
  observacao?: string;
  registrado_por?: string;
}

export function useYoloFeedbackMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FeedbackPayload) => api.yoloFeedback.upsert(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['yolo_feedback', variables.levantamento_item_id] });
    },
  });
}
