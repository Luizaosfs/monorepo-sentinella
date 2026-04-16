import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/**
 * Lista clusters de focos recorrentes ativos (últimos 30 dias) para o cliente.
 * Cada cluster representa um local com >= 2 ocorrências.
 * Usado no dashboard, mapa e painel de alertas.
 */
export function useRecorrenciasAtivas(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['recorrencias_ativas', clienteId],
    queryFn: () => api.recorrencias.listAtivasByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.RECENT, // 2 min — dados mudam com novos itens
  });
}

/**
 * Contagem de clusters ativos — para badge de alerta no header/dashboard.
 */
export function useRecorrenciasCount(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['recorrencias_count', clienteId],
    queryFn: () => api.recorrencias.countAtivasByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.RECENT,
  });
}

/**
 * Itens individuais de um cluster de recorrência.
 * Usado no painel de detalhes ao clicar em um cluster no mapa ou lista.
 */
export function useRecorrenciaItens(recorrenciaId: string | null | undefined) {
  return useQuery({
    queryKey: ['recorrencia_itens', recorrenciaId],
    queryFn: () => api.recorrencias.listItensByRecorrencia(recorrenciaId!),
    enabled: !!recorrenciaId,
  });
}
