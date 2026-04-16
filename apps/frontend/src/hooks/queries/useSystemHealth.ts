import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/** Status atual de cada serviço (via view v_system_health_atual). Revalida a cada 2 minutos. */
export function useSystemHealthStatus() {
  return useQuery({
    queryKey: ['system-health-status'],
    queryFn: () => api.systemHealth.latestByServico(),
    staleTime: STALE.SHORT,
    refetchInterval: 2 * 60 * 1000, // polling a cada 2 minutos na tela aberta
  });
}

/** Histórico de logs de um serviço específico (ou todos). */
export function useSystemHealthLogs(servico?: string) {
  return useQuery({
    queryKey: ['system-health-logs', servico ?? 'all'],
    queryFn: () => api.systemHealth.listLogs(servico, 200),
    staleTime: STALE.SHORT,
  });
}

/** Alertas ativos (não resolvidos). */
export function useSystemAlerts(apenasAtivos = true) {
  return useQuery({
    queryKey: ['system-alerts', apenasAtivos],
    queryFn: () => api.systemHealth.listAlerts(apenasAtivos),
    staleTime: STALE.SHORT,
    refetchInterval: 2 * 60 * 1000,
  });
}

/** Resolve um alerta manualmente. */
export function useResolverAlertaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.systemHealth.resolverAlerta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
    },
  });
}

/** Dispara health-check manualmente e revalida tudo. */
export function useTriggerHealthCheckMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.systemHealth.triggerHealthCheck(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-health-status'] });
      queryClient.invalidateQueries({ queryKey: ['system-health-logs'] });
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
    },
  });
}
