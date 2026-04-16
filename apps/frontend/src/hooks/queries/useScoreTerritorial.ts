import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

export interface TerritorioScore {
  cliente_id: string;
  imovel_id: string;
  score: number;
  classificacao: 'baixo' | 'medio' | 'alto' | 'muito_alto' | 'critico';
  fatores: {
    focos_ativos: number;
    focos_confirmados: number;
    focos_recorrentes: number;
    focos_historico: number;
    focos_resolvidos_recentes: number;
    casos_proximos: number;
    chuva_alta: boolean;
    temp_alta: boolean;
    denuncia_cidadao: number;
    imovel_recusa: boolean;
    sla_vencido: number;
    vistoria_negativa: boolean;
    pontos_focos: number;
    pontos_epidem: number;
    pontos_hist: number;
  };
  calculado_em: string;
  versao_config: string | null;
}

export interface ScoreBairro {
  cliente_id: string;
  bairro: string | null;
  regiao_id: string | null;
  imoveis_com_score: number;
  score_medio: number;
  score_maximo: number;
  score_p75: number;
  imoveis_criticos: number;
  imoveis_alto: number;
  ultimo_calculo: string;
}

export interface ScoreConfig {
  cliente_id: string;
  peso_foco_suspeito: number;
  peso_foco_confirmado: number;
  peso_foco_em_tratamento: number;
  peso_foco_recorrente: number;
  peso_historico_3focos: number;
  peso_caso_300m: number;
  peso_chuva_alta: number;
  peso_temperatura_30: number;
  peso_denuncia_cidadao: number;
  peso_imovel_recusa: number;
  peso_sla_vencido: number;
  peso_foco_resolvido: number;
  peso_vistoria_negativa: number;
  janela_resolucao_dias: number;
  janela_vistoria_dias: number;
  janela_caso_dias: number;
  cap_focos: number;
  cap_epidemio: number;
  cap_historico: number;
  updated_at: string;
}

export const COR_SCORE: Record<string, string> = {
  baixo:      'text-emerald-600 bg-emerald-50 border-emerald-200',
  medio:      'text-amber-600 bg-amber-50 border-amber-200',
  alto:       'text-orange-600 bg-orange-50 border-orange-200',
  muito_alto: 'text-red-600 bg-red-50 border-red-200',
  critico:    'text-white bg-red-700 border-red-800',
};

export const LABEL_SCORE: Record<string, string> = {
  baixo:      'Baixo',
  medio:      'Médio',
  alto:       'Alto',
  muito_alto: 'Muito Alto',
  critico:    'Crítico',
};

export const RANGE_SCORE: Record<string, [number, number]> = {
  baixo:      [0,  20],
  medio:      [21, 40],
  alto:       [41, 60],
  muito_alto: [61, 80],
  critico:    [81, 100],
};

export function useScoreImovel(imovelId: string | undefined) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['score-imovel', imovelId],
    queryFn:  () => api.score.getImovel(clienteId!, imovelId!),
    enabled:  !!clienteId && !!imovelId,
    staleTime: STALE.MEDIUM,
  });
}

export function useScoreTopCriticos(limit = 20) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['score-top-criticos', clienteId, limit],
    queryFn:  () => api.score.listTopCriticos(clienteId!, limit),
    enabled:  !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useScoreBairros() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['score-bairros', clienteId],
    queryFn:  () => api.score.listBairros(clienteId!),
    enabled:  !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useScoreConfig() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['score-config', clienteId],
    queryFn:  () => api.score.getConfig(clienteId!),
    enabled:  !!clienteId,
    staleTime: STALE.LONG,
  });
}

export function useForcarRecalculoScore() {
  const { clienteId } = useClienteAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imovelId: string) => api.score.forcarRecalculo(clienteId!, imovelId),
    onSuccess: (_, imovelId) => {
      qc.invalidateQueries({ queryKey: ['score-imovel', imovelId] });
      qc.invalidateQueries({ queryKey: ['score-top-criticos', clienteId] });
      qc.invalidateQueries({ queryKey: ['central-kpis', clienteId] });
    },
  });
}

export function useUpsertScoreConfig() {
  const { clienteId } = useClienteAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<ScoreConfig>) => api.score.upsertConfig(clienteId!, config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['score-config', clienteId] });
    },
  });
}
