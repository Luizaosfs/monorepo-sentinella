import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { FocoRiscoFiltros, FocoRiscoStatus, FocoRiscoPrioridade, FocoRiscoClassificacao, getTransicoesPermitidas, FocoRiscoTimelineItem, FocoDadosMinimosStatus } from '@/types/database';

// ── useFocosRisco ─────────────────────────────────────────────────────────────

export function useFocosRisco(
  clienteId: string | null | undefined,
  filtros?: FocoRiscoFiltros,
) {
  // Serializar filtros como primitivos para evitar instabilidade de referência no cache
  const f = filtros ?? {};
  return useQuery({
    queryKey: [
      'focos_risco', clienteId,
      f.status?.join(',') ?? null,
      f.prioridade?.join(',') ?? null,
      f.regiao_id ?? null,
      f.imovel_id ?? null,
      f.ciclo ?? null,
      f.origem_tipo ?? null,
      f.page ?? null,
      f.pageSize ?? null,
      f.de?.toISOString() ?? null,
      f.ate?.toISOString() ?? null,
    ],
    queryFn:  () => api.focosRisco.list(clienteId!, filtros),
    enabled:  !!clienteId,
    staleTime: STALE.SHORT,
  });
}

// ── useFocoRisco (single) ─────────────────────────────────────────────────────

export function useFocoRisco(id: string | null | undefined) {
  return useQuery({
    queryKey: ['foco_risco', id],
    queryFn:  async () => {
      const [foco, historico, timeline] = await Promise.all([
        api.focosRisco.getById(id!),
        api.focosRisco.historico(id!),
        api.focosRisco.timeline(id!),
      ]);
      return { foco, historico, timeline };
    },
    enabled:   !!id,
    staleTime: STALE.SHORT,
  });
}

/** Dados mínimos de um foco — view v_focos_dados_minimos_status. */
export function useFocoDadosMinimos(id: string | null | undefined) {
  return useQuery<FocoDadosMinimosStatus | null>({
    queryKey: ['foco_dados_minimos', id],
    queryFn:  () => api.focosRisco.dadosMinimos(id!),
    enabled:  !!id,
    staleTime: STALE.SHORT,
  });
}

/** Hook dedicado apenas à timeline de um foco (para painéis de detalhe). */
export function useFocoRiscoTimeline(id: string | null | undefined) {
  return useQuery<FocoRiscoTimelineItem[]>({
    queryKey: ['foco_risco_timeline', id],
    queryFn:  () => api.focosRisco.timeline(id!),
    enabled:  !!id,
    staleTime: STALE.SHORT,
  });
}

// ── useIniciarInspecaoFoco ─────────────────────────────────────────────────────

/** Inicia inspeção formal de um foco. Idempotente: se já em_inspecao, retorna ok. */
export function useIniciarInspecaoFoco() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ focoId, observacao }: { focoId: string; observacao?: string }) =>
      api.focosRisco.iniciarInspecao(focoId, observacao),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['focos_risco'] });
      qc.invalidateQueries({ queryKey: ['focos_atribuidos'] });
      qc.invalidateQueries({ queryKey: ['foco_risco', variables.focoId] });
    },
  });
}

// ── useAtualizarStatusFoco ────────────────────────────────────────────────────

export function useAtualizarStatusFoco() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      focoId,
      statusNovo,
      motivo,
      responsavelId,
    }: {
      focoId: string;
      statusNovo: FocoRiscoStatus;
      motivo?: string;
      responsavelId?: string;
    }) => {
      // Validação client-side antes de chamar o banco
      // (o banco também valida, mas melhor feedback imediato)
      return api.focosRisco.transicionar(focoId, statusNovo, motivo, responsavelId);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['focos_risco'] });
      qc.invalidateQueries({ queryKey: ['focos_risco_triagem_kpis'], exact: false });
      qc.invalidateQueries({ queryKey: ['foco_risco', variables.focoId] });
      qc.invalidateQueries({ queryKey: ['foco_risco_ativo_sheet', variables.focoId] });
    },
  });
}

/** Retorna as transições válidas para um status — útil para montar menus. */
export { getTransicoesPermitidas };

// ── useAtualizarClassificacaoFoco ─────────────────────────────────────────────

export function useAtualizarClassificacaoFoco() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      focoId,
      classificacao,
    }: {
      focoId: string;
      classificacao: FocoRiscoClassificacao;
    }) => api.focosRisco.atualizarClassificacao(focoId, classificacao),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['focos_risco'] });
      qc.invalidateQueries({ queryKey: ['foco_risco', variables.focoId] });
      qc.invalidateQueries({ queryKey: ['foco_risco_timeline', variables.focoId] });
      qc.invalidateQueries({ queryKey: ['foco_risco_ativo_sheet', variables.focoId] });
    },
  });
}

// ── useFocoByLevantamentoItem ─────────────────────────────────────────────────

/** Hook para buscar o foco_risco vinculado a um levantamento_item específico.
 *  clienteId é obrigatório para garantir isolamento de tenant. */
export function useFocoByLevantamentoItem(
  itemId: string | null | undefined,
  clienteId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['foco_by_item', itemId, clienteId],
    queryFn:  () => api.focosRisco.byLevantamentoItem(itemId!, clienteId!),
    enabled:  !!itemId && !!clienteId,
    staleTime: STALE.SHORT,
  });
}

// ── useEvidenciasFoco ─────────────────────────────────────────────────────────

/** Busca evidências de um foco: operações de campo + evidências da detecção original. */
export function useEvidenciasFoco(
  focoId: string | null | undefined,
  clienteId: string | null | undefined,
  origemItemId: string | null | undefined,
) {
  const operacoes = useQuery({
    queryKey: ['evidencias_foco_operacoes', focoId, clienteId],
    queryFn: () => api.operacoes.listByFoco(focoId!, clienteId!),
    enabled: !!focoId && !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  const deteccao = useQuery({
    queryKey: ['evidencias_foco_deteccao', origemItemId],
    queryFn: () => api.levantamentoItemEvidencias.listByItem(origemItemId!),
    enabled: !!origemItemId,
    staleTime: STALE.LONG,
  });

  return { operacoes, deteccao };
}

// ── useFocosDoImovel ──────────────────────────────────────────────────────────

/** Focos ativos vinculados a um imóvel — para alertar agente em campo. */
export function useFocosDoImovel(
  imovelId: string | null | undefined,
  clienteId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['focos_imovel', imovelId, clienteId],
    queryFn: () => api.focosRisco.listByImovel(imovelId!, clienteId!),
    enabled: !!imovelId && !!clienteId,
    staleTime: STALE.SHORT,
  });
}

// ── useCriarFocoManual ────────────────────────────────────────────────────────

export function useCriarFocoManual() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      cliente_id: string;
      imovel_id?: string;
      regiao_id?: string;
      latitude?: number;
      longitude?: number;
      prioridade?: FocoRiscoPrioridade;
      endereco_normalizado?: string;
      responsavel_id?: string;
    }) => api.focosRisco.criar(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['focos_risco', variables.cliente_id] });
    },
  });
}
