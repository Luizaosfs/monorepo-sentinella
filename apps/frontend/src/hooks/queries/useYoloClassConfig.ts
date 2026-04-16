import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { SentinelaYoloClassConfig } from '@/types/database';

/**
 * Carrega a configuração de classes YOLO do cliente (item_key → ação, risco, peso).
 * Usado para auto-preencher Ação e Risco no formulário de criação manual de item.
 */
export function useYoloClassConfig(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['yolo_class_config', clienteId],
    queryFn: () => api.yoloClassConfig.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: 10 * 60 * 1000, // muda raramente — 10 min
  });
}

/** Encontra a classe YOLO pelo item_key (= tag slug). */
export function findYoloClass(
  classes: SentinelaYoloClassConfig[],
  itemKey: string,
): SentinelaYoloClassConfig | undefined {
  return classes.find((c) => c.item_key === itemKey);
}
