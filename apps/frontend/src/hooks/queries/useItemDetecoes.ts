import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/**
 * Todas as detecções YOLO de um item (tabela levantamento_item_detecoes).
 * Passar null para itemId desabilita a query (itens manuais ou sem detecções).
 */
export function useItemDetecoes(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['item_detecoes', itemId],
    queryFn: () => api.itens.listDetecoes(itemId!),
    enabled: !!itemId,
    staleTime: STALE.STATIC, // detecções não mudam após o upload
  });
}
