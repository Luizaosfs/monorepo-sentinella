import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { getCurrentCiclo } from '@/lib/ciclo';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface Ciclo {
  id: string;
  cliente_id: string;
  numero: number;
  ano: number;
  status: 'planejamento' | 'ativo' | 'fechado';
  data_inicio: string;
  data_fim_prevista: string;
  data_fechamento: string | null;
  meta_cobertura_pct: number;
  snapshot_fechamento: CicloSnapshot | null;
  observacao_abertura: string | null;
  observacao_fechamento: string | null;
  aberto_por: string | null;
  fechado_por: string | null;
  created_at: string;
  updated_at: string;
  // campos calculados da view
  ciclo_numero_efetivo: number;
  pct_tempo_decorrido: number | null;
}

export interface CicloSnapshot {
  fechado_em: string;
  total_vistorias: number;
  total_imoveis: number;
  cobertura_pct: number;
  total_focos: number;
  focos_resolvidos: number;
  taxa_resolucao_pct: number;
  liraa: {
    iip: number;
    ib: number;
    classificacao_risco: string;
    inspecionados: number;
    imoveis_com_foco: number;
  };
}

export interface CicloProgresso {
  cliente_id: string;
  ciclo: number;
  imoveis_total: number;
  imoveis_visitados: number;
  imoveis_sem_acesso: number;
  cobertura_pct: number;
  vistorias_total: number;
  vistorias_liraa: number;
  agentes_ativos: number;
  focos_total: number;
  focos_ativos: number;
  focos_resolvidos: number;
  alertas_retorno_pendentes: number;
}

// ── Labels de ciclo ───────────────────────────────────────────────────────────

export const CICLO_LABELS: Record<number, string> = {
  1: 'Ciclo 1 — Jan/Fev',
  2: 'Ciclo 2 — Mar/Abr',
  3: 'Ciclo 3 — Mai/Jun',
  4: 'Ciclo 4 — Jul/Ago',
  5: 'Ciclo 5 — Set/Out',
  6: 'Ciclo 6 — Nov/Dez',
};

export const CICLO_STATUS_COR: Record<string, string> = {
  planejamento: 'text-muted-foreground bg-muted border-muted-foreground/30',
  ativo:        'text-emerald-700 bg-emerald-50 border-emerald-300',
  fechado:      'text-slate-600 bg-slate-50 border-slate-300',
};

export const CICLO_STATUS_LABEL: Record<string, string> = {
  planejamento: 'Planejamento',
  ativo:        'Ativo',
  fechado:      'Fechado',
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Retorna o ciclo ativo do cliente. Se não houver ciclo formal,
 * `data` é null mas `cicloNumero` retorna o bimestre pelo calendário.
 */
export function useCicloAtivo() {
  const { clienteId } = useClienteAtivo();
  const query = useQuery({
    queryKey: ['ciclo-ativo', clienteId],
    queryFn: () => api.ciclos.getCicloAtivo(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  // Fallback: usa calendário se não há ciclo formal
  const cicloNumero = query.data?.ciclo_numero_efetivo ?? getCurrentCiclo();

  return { ...query, cicloNumero };
}

/**
 * KPIs de progresso do ciclo ativo.
 */
export function useCicloProgresso() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['ciclo-progresso', clienteId],
    queryFn: () => api.ciclos.getProgresso(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    refetchInterval: 3 * 60 * 1000,
  });
}

/**
 * Histórico de todos os ciclos do cliente.
 */
export function useHistoricoCiclos() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['ciclos-historico', clienteId],
    queryFn: () => api.ciclos.listHistorico(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

/**
 * Abre um ciclo bimestral formal.
 */
export function useAbrirCiclo() {
  const { clienteId } = useClienteAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      numero: number;
      ano?: number;
      meta_cobertura_pct?: number;
      observacao?: string;
    }) => api.ciclos.abrir(clienteId!, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ciclo-ativo', clienteId] });
      qc.invalidateQueries({ queryKey: ['ciclos-historico', clienteId] });
      qc.invalidateQueries({ queryKey: ['ciclo-progresso', clienteId] });
    },
  });
}

/**
 * Fecha o ciclo ativo e gera snapshot de indicadores.
 */
export function useFecharCiclo() {
  const { clienteId } = useClienteAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      numero: number;
      ano?: number;
      observacao?: string;
    }) => api.ciclos.fechar(clienteId!, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ciclo-ativo', clienteId] });
      qc.invalidateQueries({ queryKey: ['ciclos-historico', clienteId] });
      qc.invalidateQueries({ queryKey: ['ciclo-progresso', clienteId] });
      qc.invalidateQueries({ queryKey: ['liraa', clienteId] });
      qc.invalidateQueries({ queryKey: ['executivo-ciclos', clienteId] });
    },
  });
}

/**
 * Copia distribuição de quarteirões do ciclo anterior para o próximo.
 */
export function useCopiarDistribuicao() {
  const { clienteId } = useClienteAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ origem, destino }: { origem: number; destino: number }) =>
      api.ciclos.copiarDistribuicao(clienteId!, origem, destino),
    onSuccess: (_, { destino }) => {
      qc.invalidateQueries({ queryKey: ['dist_quarteirao', clienteId, destino] });
    },
  });
}
