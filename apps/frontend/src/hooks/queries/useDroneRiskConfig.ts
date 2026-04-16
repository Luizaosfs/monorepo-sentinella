import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { DroneRisco, DronePrioridade, SentinelaDroneRiskConfig } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

export function useDroneRiskConfig(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['drone_risk_config', clienteId],
    queryFn: () => api.droneRiskConfig.getByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

/** Mapeamento DronePrioridade → label usado no form (prioridade como string). */
const PRIORIDADE_LABEL: Record<DronePrioridade, string> = {
  P1: 'Urgente',
  P2: 'Alta',
  P3: 'Média',
  P4: 'Baixa',
  P5: 'Monitoramento',
};

/**
 * Deriva score_final, prioridade e sla_horas a partir do risco e da config do cliente.
 * Espelha a lógica do pipeline Python (analysis_service / risk_refinement_service).
 */
export function derivarClassificacao(
  risco: DroneRisco,
  config: SentinelaDroneRiskConfig,
): { score_final: number; prioridade: string; sla_horas: number } {
  const score = config.base_by_risco[risco] ?? 0;

  // Percorre P1→P5: primeiro threshold que o score atinge vira a prioridade
  const niveis: DronePrioridade[] = ['P1', 'P2', 'P3', 'P4', 'P5'];
  let prioridadeKey: DronePrioridade = 'P5';
  for (const nivel of niveis) {
    if (score >= (config.priority_thresholds[nivel] ?? 0)) {
      prioridadeKey = nivel;
      break;
    }
  }

  return {
    score_final: score,
    prioridade: PRIORIDADE_LABEL[prioridadeKey],
    sla_horas: config.sla_by_priority_hours[prioridadeKey] ?? 24,
  };
}
