import { QueryClient } from '@tanstack/react-query';

/**
 * Invalida caches ligados a status de atendimento para alinhar dashboard,
 * lista do operador e mapas após updateAtendimento / check-in.
 */
export function invalidateAtendimentoItemCaches(
  queryClient: QueryClient,
  args: { clienteId: string; levantamentoId?: string | null }
) {
  const { clienteId, levantamentoId } = args;
  queryClient.invalidateQueries({ queryKey: ['itens_cliente', clienteId] });
  queryClient.invalidateQueries({ queryKey: ['itens_operador', clienteId] });
  queryClient.invalidateQueries({ queryKey: ['map_items', clienteId] });
  queryClient.invalidateQueries({ queryKey: ['map_full_data', clienteId] });
  queryClient.invalidateQueries({ queryKey: ['item_statuses', clienteId] });
  queryClient.invalidateQueries({ queryKey: ['atendimento_counts', clienteId] });
  queryClient.invalidateQueries({ queryKey: ['itens_resolvidos_recentes', clienteId] });
  if (levantamentoId) {
    queryClient.invalidateQueries({ queryKey: ['levantamento_itens', levantamentoId] });
  }
}
