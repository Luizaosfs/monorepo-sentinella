import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

export interface CentralOperacionalKpis {
  cliente_id: string;
  data_ref: string;
  focos_pendentes: number;
  focos_em_atendimento: number;
  focos_p1_sem_agente: number;
  slas_vencidos: number;
  slas_vencendo_2h: number;
  imoveis_criticos: number;
  imoveis_muito_alto: number;
  score_medio_municipio: number | null;
  vistorias_hoje: number;
  agentes_ativos_hoje: number;
  denuncias_ultimas_24h: number;
  casos_hoje: number;
}

export interface ImovelParaHoje {
  cliente_id: string;
  imovel_id: string;
  score: number;
  classificacao: string;
  fatores: Record<string, unknown>;
  calculado_em: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  latitude: number | null;
  longitude: number | null;
  historico_recusa: boolean;
  prioridade_drone: boolean;
  sla_mais_urgente: string | null;
  prioridade_foco_ativo: string | null;
  focos_ativos_count: number;
}

export function useCentralKpis() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['central-kpis', clienteId],
    queryFn:  () => api.central.getKpis(),
    enabled:  !!clienteId,
    staleTime: STALE.SHORT,
    refetchInterval: 60_000,
  });
}

export function useImoveisParaHoje(limit = 30) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['imoveis-para-hoje', clienteId, limit],
    queryFn:  () => api.central.listImoveisParaHoje(clienteId!, limit),
    enabled:  !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}
