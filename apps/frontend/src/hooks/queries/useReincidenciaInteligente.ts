import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface ImovelReincidente {
  cliente_id: string;
  imovel_id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  regiao_id: string | null;
  latitude: number | null;
  longitude: number | null;
  historico_recusa: boolean;
  prioridade_drone: boolean;
  total_focos_historico: number;
  focos_reincidentes: number;
  focos_ativos: number;
  ultimo_foco_em: string;
  primeiro_foco_em: string;
  intervalo_medio_dias: number | null;
  ciclos_com_foco: number;
  origens: string[];
  taxa_resolucao_pct: number | null;
  deposito_predominante: string | null;
  tentativas_sem_acesso: number;
  usou_larvicida_alguma_vez: boolean | null;
  ultima_vistoria_com_acesso: string | null;
  padrao: 'cronico' | 'recorrente' | 'pontual';
  dias_desde_ultimo_foco: number;
}

export interface ReincidenciaPorDeposito {
  cliente_id: string;
  bairro: string | null;
  regiao_id: string | null;
  tipo_deposito: string;
  imoveis_afetados: number;
  total_focos_deposito: number;
  total_eliminados: number;
  ciclos_com_ocorrencia: number;
  taxa_eliminacao_pct: number | null;
  uso_larvicida_pct: number | null;
  imoveis_multiciclo: number;
  indice_reincidencia_pct: number | null;
}

export interface ReincidenciaSazonalidade {
  cliente_id: string;
  bairro: string | null;
  regiao_id: string | null;
  ciclo: number;
  focos_total: number;
  focos_reincidentes: number;
  focos_resolvidos: number;
  anos_com_ocorrencia: number;
  media_focos_por_ano: number;
  delta_tendencia: number;
}

export interface RiscoReincidencia {
  score: number;
  classificacao: 'alto' | 'medio' | 'baixo';
  fatores: {
    total_focos: number;
    focos_reincidentes: number;
    focos_ativos: number;
    ciclos_com_foco: number;
    ultimo_foco_dias: number;
    intervalo_medio_dias: number;
    sem_acesso: number;
    deposito_cronico: boolean;
    tem_larvicida: boolean;
    taxa_resolucao_pct: number;
  };
}

// ── Labels e cores ─────────────────────────────────────────────────────────────

export const PADRAO_LABEL: Record<string, string> = {
  cronico:    'Crônico',
  recorrente: 'Recorrente',
  pontual:    'Pontual',
};

export const PADRAO_COR: Record<string, string> = {
  cronico:    'text-red-700 bg-red-50 border-red-200',
  recorrente: 'text-orange-700 bg-orange-50 border-orange-200',
  pontual:    'text-amber-700 bg-amber-50 border-amber-200',
};

export const RISCO_REINCIDENCIA_COR: Record<string, string> = {
  alto:  'text-red-700 bg-red-50 border-red-200',
  medio: 'text-orange-600 bg-orange-50 border-orange-200',
  baixo: 'text-emerald-600 bg-emerald-50 border-emerald-200',
};

export const DEPOSITO_LABELS: Record<string, string> = {
  A1: "A1 — Caixa d'água",
  A2: 'A2 — Poço/cisterna',
  B:  'B — Nível do solo',
  C:  'C — Fixo',
  D1: 'D1 — Pneu',
  D2: 'D2 — Lixo/entulho',
  E:  'E — Natural',
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useImoveisReincidentes(
  filtros?: { padrao?: 'cronico' | 'recorrente' | 'pontual'; bairro?: string; limit?: number }
) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['imoveis-reincidentes', clienteId, filtros],
    queryFn: () => api.reincidencia.listImoveisReincidentes(clienteId!, filtros),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

export function useReincidenciaPorDeposito(bairro?: string) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['reincidencia-deposito', clienteId, bairro],
    queryFn: () => api.reincidencia.listPorDeposito(clienteId!, bairro),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

export function useReincidenciaSazonalidade() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['reincidencia-sazonalidade', clienteId],
    queryFn: () => api.reincidencia.listSazonalidade(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

export function useRiscoReincidenciaImovel(imovelId: string | undefined) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['risco-reincidencia-imovel', imovelId],
    queryFn: () => api.reincidencia.scoreImovel(clienteId!, imovelId!),
    enabled: !!clienteId && !!imovelId,
    staleTime: STALE.MEDIUM,
  });
}

export function useHistoricoCiclosImovel(imovelId: string | undefined) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['historico-ciclos-imovel', imovelId],
    queryFn: () => api.reincidencia.historicoCiclosImovel(clienteId!, imovelId!),
    enabled: !!clienteId && !!imovelId,
    staleTime: STALE.MEDIUM,
  });
}

/** Hook derivado: bairros que tendem a piorar no próximo ciclo — sem query extra */
export function useBairrosEmAlertaSazonal(proximoCiclo: number) {
  const { data: sazonalidade = [] } = useReincidenciaSazonalidade();

  return sazonalidade
    .filter(s => s.ciclo === proximoCiclo && s.delta_tendencia > 0)
    .sort((a, b) => b.delta_tendencia - a.delta_tendencia)
    .slice(0, 5);
}
