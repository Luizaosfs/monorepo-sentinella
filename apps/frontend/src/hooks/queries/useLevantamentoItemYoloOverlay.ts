import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { LevantamentoItem, LevantamentoItemDetecao } from '@/types/database';

export type ItemYoloOverlayData = {
  detection_bbox: LevantamentoItem['detection_bbox'] | null;
  detecoes: LevantamentoItemDetecao[];
};

/**
 * detection_bbox + todas as detecções YOLO de um levantamento_item (detalhe / lightbox com overlay).
 */
export function useLevantamentoItemYoloOverlay(
  itemId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const enabled = (options?.enabled ?? true) && !!itemId;
  return useQuery({
    queryKey: ['item_yolo_overlay', itemId],
    queryFn: async (): Promise<ItemYoloOverlayData> => {
      const [detecoes, detection_bbox] = await Promise.all([
        api.itens.listDetecoes(itemId!),
        api.itens.getDetectionBbox(itemId!),
      ]);
      return { detecoes, detection_bbox };
    },
    enabled,
    staleTime: STALE.STATIC,
  });
}
