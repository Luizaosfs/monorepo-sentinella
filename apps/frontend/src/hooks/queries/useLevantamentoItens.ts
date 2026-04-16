import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE, GC } from '@/lib/queryConfig';

export const useLevantamentoItens = (levId: string | null) => {
  return useQuery({
    queryKey: ['levantamento_itens', levId],
    queryFn: () => api.itens.listByLevantamento(levId!),
    enabled: !!levId,
    staleTime: STALE.MEDIUM,
    gcTime: GC.EXTENDED,
  });
};

export const useItensPorCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['itens_cliente', clienteId],
    queryFn: () => api.itens.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    gcTime: GC.EXTENDED,
    refetchInterval: STALE.SHORT,
  });
};

/** KPIs de atendimento no dashboard (todos os itens do cliente, sem limite de 1000 linhas). */
export const useAtendimentoCountsPorCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['atendimento_counts', clienteId],
    queryFn: () => api.itens.countStatusAtendimentoByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    gcTime: GC.EXTENDED,
  });
};

export const useResolvidosRecentesPorCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['itens_resolvidos_recentes', clienteId],
    queryFn: () => api.itens.listRecentResolvidosPorCliente(clienteId!, 4),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    gcTime: GC.EXTENDED,
  });
};
