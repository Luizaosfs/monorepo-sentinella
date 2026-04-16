import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

// ============================================================
// Interfaces
// ============================================================

export interface ExecutivoKpis {
  cliente_id: string;
  semana_ref: string;
  total_focos_ativos: number;
  focos_novos_semana: number;
  focos_resolvidos_semana: number;
  taxa_resolucao_pct: number | null;
  slas_vencidos: number;
  sla_conformidade_pct: number | null;
  imoveis_visitados_semana: number;
  cobertura_pct: number | null;
  score_medio: number | null;
  imoveis_criticos: number;
  casos_novos_semana: number;
  agentes_ativos_semana: number;
}

export interface ExecutivoTendencia {
  cliente_id: string;
  semana_inicio: string;
  focos_novos: number;
  focos_resolvidos: number;
  vistorias: number;
  casos: number;
  score_medio: number | null;
}

export interface ExecutivoCobertura {
  cliente_id: string;
  bairro: string;
  total_imoveis: number;
  imoveis_visitados_30d: number;
  cobertura_pct: number | null;
  score_medio_bairro: number | null;
  focos_ativos: number;
  imoveis_criticos: number;
}

export interface ExecutivoBairroVariacao {
  cliente_id: string;
  bairro: string;
  score_atual: number | null;
  focos_novos_7d: number;
  focos_novos_30d: number;
  casos_30d: number;
  vistorias_30d: number;
  variacao_focos: number | null;
  classificacao_tendencia: 'piorando' | 'melhorando' | 'estavel';
}

export interface ExecutivoComparativoCiclos {
  cliente_id: string;
  ciclo_atual_inicio: string;
  ciclo_anterior_inicio: string;
  focos_atual: number;
  focos_anterior: number;
  resolucao_atual: number;
  resolucao_anterior: number;
  vistorias_atual: number;
  vistorias_anterior: number;
  casos_atual: number;
  casos_anterior: number;
  variacao_focos_pct: number | null;
  variacao_resolucao_pct: number | null;
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Returns true if the delta represents a positive change for the given metric.
 * For focos/slas/casos: lower is better (negative delta = positive).
 * For resolucao/cobertura/vistorias: higher is better (positive delta = positive).
 */
export function deltaPositivo(
  metric: 'focos' | 'slas' | 'resolucao' | 'cobertura' | 'vistorias' | 'casos',
  delta: number
): boolean {
  switch (metric) {
    case 'focos':
    case 'slas':
    case 'casos':
      return delta < 0;
    case 'resolucao':
    case 'cobertura':
    case 'vistorias':
      return delta > 0;
    default:
      return false;
  }
}

/**
 * Classifica o IIP no nível municipal seguindo os mesmos limiares do LIRAa.
 * < 1.0  → satisfatorio
 * < 3.9  → alerta
 * < 5.0  → risco
 * >= 5.0 → perigo
 */
export function classificarIIPMunicipal(
  iip: number
): 'satisfatorio' | 'alerta' | 'risco' | 'perigo' {
  if (iip < 1.0) return 'satisfatorio';
  if (iip < 3.9) return 'alerta';
  if (iip < 5.0) return 'risco';
  return 'perigo';
}

// ============================================================
// Hooks
// ============================================================

/**
 * KPIs estratégicos da semana atual para o cliente logado.
 * Retorna uma única linha da view v_executivo_kpis.
 * Refetch a cada 5 minutos — dados operacionais de alta relevância.
 */
export function useExecutivoKpis() {
  return useQuery({
    queryKey: ['executivo-kpis'],
    queryFn: () => api.executivo.getKpis(),
    staleTime: STALE.SHORT,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Tendência das últimas 8 semanas para o cliente logado.
 * Séries temporais de focos, vistorias, casos e score médio.
 */
export function useExecutivoTendencia() {
  const { clienteId } = useClienteAtivo();

  return useQuery({
    queryKey: ['executivo-tendencia', clienteId],
    queryFn: () => api.executivo.getTendencia(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

/**
 * Cobertura territorial por bairro — baseada nos últimos 30 dias.
 * Inclui score médio, focos ativos e imóveis críticos por bairro.
 */
export function useExecutivoCobertura() {
  const { clienteId } = useClienteAtivo();

  return useQuery({
    queryKey: ['executivo-cobertura', clienteId],
    queryFn: () => api.executivo.getCobertura(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

/**
 * Ranking de bairros com variação de focos e classificação de tendência.
 * Útil para identificar áreas em deterioração rápida.
 */
export function useExecutivoBairrosVariacao() {
  const { clienteId } = useClienteAtivo();

  return useQuery({
    queryKey: ['executivo-bairros-variacao', clienteId],
    queryFn: () => api.executivo.getBairrosVariacao(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

/**
 * Comparativo entre o ciclo epidemiológico atual e o anterior (períodos de 2 meses).
 * Retorna variações percentuais de focos, resolução, vistorias e casos.
 */
export function useExecutivoComparativoCiclos() {
  return useQuery({
    queryKey: ['executivo-comparativo-ciclos'],
    queryFn: () => api.executivo.getComparativoCiclos(),
    staleTime: STALE.LONG,
  });
}

/**
 * Hook derivado — agrega dados de cobertura sem consulta adicional ao banco.
 * Retorna totais consolidados e contagem de bairros em risco (cobertura < 50%).
 */
export function useCoberturaAgregada(): {
  totalImoveis: number;
  visitados30d: number;
  coberturaMediaPct: number | null;
  bairrosEmRisco: number;
} {
  const { data } = useExecutivoCobertura();

  if (!data || data.length === 0) {
    return {
      totalImoveis: 0,
      visitados30d: 0,
      coberturaMediaPct: null,
      bairrosEmRisco: 0,
    };
  }

  const totalImoveis = data.reduce((acc, b) => acc + b.total_imoveis, 0);
  const visitados30d = data.reduce((acc, b) => acc + b.imoveis_visitados_30d, 0);
  const coberturaMediaPct =
    totalImoveis > 0
      ? Math.round((visitados30d * 100.0) / totalImoveis * 10) / 10
      : null;
  const bairrosEmRisco = data.filter(
    (b) => b.cobertura_pct !== null && b.cobertura_pct < 50
  ).length;

  return {
    totalImoveis,
    visitados30d,
    coberturaMediaPct,
    bairrosEmRisco,
  };
}
