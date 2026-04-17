import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { captureError } from '@/lib/sentry';

/** Loga o erro no Sentry com contexto e relança — usar em métodos críticos. */
function logAndThrow(error: unknown, method: string, extra?: Record<string, unknown>): never {
  captureError(error, { method, ...extra });
  throw error;
}
import { calcularSemanaEpidemiologica, montarPayloadESUS } from '@/lib/sinan';
import { enrichItensComFoco } from '@/lib/enrichItensComFoco';
import { mapFocoToStatusOperacional, type FocoStatus } from '@/lib/mapStatusOperacional';
import { Levantamento, LevantamentoItem, LevantamentoItemDetecao, LevantamentoItemEvidencia, LevantamentoItemStatusHistorico, PlanoAcaoCatalogo, LevantamentoItemRecorrencia, RecorrenciaAtiva, SlaFeriado, SlaIminente, SlaConfigRegiao, ClienteQuota, ClienteUsoMensal, QuotaVerificacao, CondicaoVoo, Cliente, Planejamento, PluvioRisco, Regiao, Tag, StatusAtendimento, AtendimentoStatusCounts, SentinelaDroneRiskConfig, SentinelaYoloClassConfig, PushSubscription, MunicipioStats, YoloFeedback, LevantamentoAnaliseIa, CasoNotificado, UnidadeSaude, StatusCaso, Imovel, ImovelResumo, Vistoria, VistoriaDeposito, VistoriaSintomas, VistoriaRiscos, StatusVistoria, VistoriaResumo, MotivoSemAcesso, HorarioSugerido, VistoriaCalha, ImovelHistoricoAcesso, Drone, Voo, Usuario, ClienteIntegracao, ItemNotificacaoESUS, ESUSNotificaPayload, TipoAgravoESUS, UnidadesSaudeSyncControle, UnidadesSaudeSyncLog, SentinelaRiskPolicy, SentinelaRiskDefaults, SentinelaRiskRule, SentinelaRiskFallbackRule, SentinelaRiskTempFactor, SentinelaRiskVentoFactor, SentinelaRiskTempAdjustPp, SentinelaRiskVentoAdjustPp, SentinelaRiskPersistenciaAdjustPp, SentinelaRiskTendenciaAdjustPp, TendenciaTipo, Quarteirao, DistribuicaoQuarteirao, CoberturaQuarteirao, ConsumoLarvicida, FocoRisco, FocoRiscoAtivo, FocoRiscoAnalytics, FocoRiscoHistorico, FocoRiscoTimelineItem, FocoRiscoStatus, FocoRiscoOrigem, FocoRiscoPrioridade, FocoRiscoFiltros, ResumoRegional, SystemHealthLog, SystemAlert, JobQueue, JobTipo, Plano, ClientePlano, BillingCiclo, BillingUsageSnapshot, BillingResumo, ReinspecaoProgramada, ReinspecaoComFoco, ReinspecaoTipo, FocoRiscoClassificacao, FocoDadosMinimosStatus } from '@/types/database';
import { SlaOperacional } from '@/types/sla';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegiaoComRisco extends Regiao {
  risco?: PluvioRisco;
}

export interface UsuarioComPapel extends Usuario {
  papel: string;
  cliente_nome?: string;
}

export interface OperacaoStat {
  status: string;
  prioridade: string | null;
}

export interface OperacaoComVinculo {
  id: string;
  cliente_id: string;
  item_id: string | null;
  tipo_vinculo: 'operacional' | 'levantamento' | 'regiao' | null;
  item_operacional_id: string | null;
  item_levantamento_id: string | null;
  regiao_id: string | null;
  status: string;
  prioridade: string | null;
  responsavel_id: string | null;
  created_at: string;
  iniciado_em: string | null;
  concluido_em: string | null;
  observacao: string | null;
  vinculo_nome?: string;
}

export interface PluvioRunWithItems {
  id: string;
  dt_ref: string;
  total_bairros: number;
  items: {
    id: string;
    bairro_nome: string;
    classificacao_risco: string;
    prioridade_operacional: string;
    chuva_24h_mm: number | null;
    tendencia: string | null;
    prob_final_min: number | null;
    prob_final_max: number | null;
    prazo_acao: string | null;
  }[];
}

// enrichItensComFoco extraído para @/lib/enrichItensComFoco (testável em isolamento)

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

function getSupabaseErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const maybeStatus = (error as { status?: unknown }).status;
  if (typeof maybeStatus === 'number') return maybeStatus;
  if (typeof maybeStatus === 'string') {
    const parsed = Number(maybeStatus);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRetryableSupabaseError(error: unknown): boolean {
  const status = getSupabaseErrorStatus(error);
  return status !== null && RETRYABLE_HTTP_STATUS.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 300): Promise<T> {
  let attempt = 0;
  // retries=2 => até 3 tentativas totais
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableSupabaseError(error) || attempt >= retries) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      await sleep(delay);
      attempt += 1;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Replica o cálculo de status_sla_inteligente da view v_focos_risco_ativos
 * (migration 20261018011000). Usado enquanto a coluna não existe no banco.
 */
function calcSlaInteligente(
  status: string,
  tempoMin: number | null,
  prazoMin: number | null,
): string {
  if (status === 'resolvido' || status === 'descartado') return 'encerrado';
  if (prazoMin == null || tempoMin == null) return 'sem_prazo';
  if (tempoMin > prazoMin) return 'vencido';
  if (tempoMin >= prazoMin * 0.9) return 'critico';
  if (tempoMin >= prazoMin * 0.7) return 'atencao';
  return 'ok';
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  levantamentos: {
    list: async (clienteId: string): Promise<Levantamento[]> => {
      const { data, error } = await supabase
        .from('levantamentos')
        .select('*')
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('data_voo', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    updatePlanejamento: async (levId: string, planejamentoId: string | null): Promise<void> => {
      const { error } = await supabase
        .from('levantamentos')
        .update({ planejamento_id: planejamentoId })
        .eq('id', levId);

      if (error) throw error;
    },
    /** Mapa planejamento_id → config_fonte (primeiro levantamento com config_fonte definido). */
    listConfigFonteMap: async (clienteId: string): Promise<Record<string, string>> => {
      const { data } = await supabase
        .from('levantamentos')
        .select('planejamento_id, config_fonte')
        .eq('cliente_id', clienteId)
        .not('config_fonte', 'is', null)
        .neq('config_fonte', 'supabase')
        .order('created_at', { ascending: false });
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { planejamento_id: string | null; config_fonte: string }[]) {
        if (row.planejamento_id && !map[row.planejamento_id]) {
          map[row.planejamento_id] = row.config_fonte;
        }
      }
      return map;
    },

    getById: async (id: string): Promise<Levantamento | null> => {
      const { data, error } = await supabase
        .from('levantamentos')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data as Levantamento | null;
    },

    create: async (payload: Omit<Levantamento, 'id' | 'created_at' | 'total_itens'>): Promise<Levantamento> => {
      const { data, error } = await supabase
        .from('levantamentos')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Levantamento;
    },

    update: async (id: string, payload: Partial<Levantamento>): Promise<void> => {
      const { error } = await supabase
        .from('levantamentos')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },

    listByPlanejamento: async (planejamentoId: string): Promise<Levantamento[]> => {
      const { data, error } = await supabase
        .from('levantamentos')
        .select('*')
        .eq('planejamento_id', planejamentoId)
        .is('deleted_at', null)
        .order('data_voo', { ascending: false });
      if (error) throw error;
      return (data || []) as Levantamento[];
    },
  },

  itens: {
    getById: async (id: string): Promise<LevantamentoItem | null> => {
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select('*, levantamento:levantamentos(*), drone:drones(marca, modelo), foco:focos_risco(id, status, desfecho, resolvido_em, codigo_foco)')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const enriched = enrichItensComFoco([data as Record<string, unknown>]);
      return enriched[0] ?? null;
    },
    listByLevantamento: async (levId: string): Promise<LevantamentoItem[]> => {
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select('*, drone:drones(marca, modelo), foco:focos_risco(id, status, desfecho, resolvido_em, codigo_foco)')
        .eq('levantamento_id', levId)
        .is('deleted_at', null)
        .order('score_final', { ascending: false });

      if (error) throw error;
      return enrichItensComFoco((data as Array<Record<string, unknown>>) || []);
    },
    listByCliente: async (clienteId: string): Promise<LevantamentoItem[]> => {
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select('*, levantamento:levantamentos!inner(*), drone:drones(marca, modelo), foco:focos_risco(id, status, desfecho, resolvido_em)')
        .eq('levantamento.cliente_id', clienteId)
        .is('deleted_at', null);

      if (error) throw error;
      return enrichItensComFoco((data as Array<Record<string, unknown>>) || []);
    },
    /**
     * Contagens globais de status por cliente via focos_risco.
     * Mapeia os 7 estados do foco para o modelo de 3 estados do dashboard.
     */
    countStatusAtendimentoByCliente: async (clienteId: string): Promise<AtendimentoStatusCounts> => {
      const { data, error } = await supabase
        .from('focos_risco')
        .select('status')
        .eq('cliente_id', clienteId);
      if (error) throw error;
      let pendente = 0, em_atendimento = 0, resolvido = 0;
      for (const { status } of (data || [])) {
        if (status === 'descartado') continue; // excluído do total operacional
        const op = mapFocoToStatusOperacional(status as FocoStatus);
        if (op === 'pendente') pendente++;
        else if (op === 'em_atendimento') em_atendimento++;
        else resolvido++;
      }
      return { total: pendente + em_atendimento + resolvido, pendente, em_atendimento, resolvido };
    },
    /** Últimos itens resolvidos (para o card do dashboard), consultados via focos_risco. */
    listRecentResolvidosPorCliente: async (clienteId: string, limit = 4): Promise<LevantamentoItem[]> => {
      const { data: focos, error: focosErr } = await supabase
        .from('focos_risco')
        .select('id, resolvido_em, desfecho, origem_levantamento_item_id')
        .eq('cliente_id', clienteId)
        .eq('status', 'resolvido')
        .not('origem_levantamento_item_id', 'is', null)
        .order('resolvido_em', { ascending: false })
        .limit(limit);
      if (focosErr) throw focosErr;
      if (!focos?.length) return [];

      const ids = (focos as { origem_levantamento_item_id: string }[]).map(f => f.origem_levantamento_item_id);
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select('*, levantamento:levantamentos!inner(*), drone:drones(marca, modelo)')
        .in('id', ids);
      if (error) throw error;

      return ((data || []) as LevantamentoItem[]).map(item => {
        const foco = (focos as { id: string; resolvido_em: string | null; desfecho: string | null; origem_levantamento_item_id: string }[])
          .find(f => f.origem_levantamento_item_id === item.id);
        return {
          ...item,
          foco_risco_id: foco?.id ?? null,
          foco_risco_status: 'resolvido' as const,
          status_atendimento: 'resolvido' as StatusAtendimento,
          data_resolucao: foco?.resolvido_em ?? null,
          acao_aplicada: foco?.desfecho ?? null,
        };
      }).sort((a, b) => (b.data_resolucao ?? '').localeCompare(a.data_resolucao ?? ''));
    },
    /** Itens direcionados ao operador (operacoes onde responsavel_id = usuarioId). */
    listByOperador: async (clienteId: string, usuarioId: string): Promise<LevantamentoItem[]> => {
      const { data: ops, error: opsError } = await supabase
        .from('operacoes')
        .select('item_levantamento_id')
        .eq('cliente_id', clienteId)
        .eq('responsavel_id', usuarioId)
        .not('item_levantamento_id', 'is', null);
      if (opsError) throw opsError;
      const ids = [...new Set((ops || []).map((o: { item_levantamento_id: string }) => o.item_levantamento_id))];
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select('*, levantamento:levantamentos!inner(*), drone:drones(marca, modelo), foco:focos_risco(id, status, desfecho, resolvido_em)')
        .in('id', ids)
        .order('data_hora', { ascending: false });
      if (error) throw error;
      return enrichItensComFoco((data as Array<Record<string, unknown>>) || []);
    },
    /** All items with location data for map pages. */
    listMapByCliente: async (clienteId: string): Promise<LevantamentoItem[]> => {
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select(
          `id, levantamento_id, latitude, longitude, item, risco, peso,
           score_final, prioridade, sla_horas, endereco_curto, endereco_completo,
           maps, waze, data_hora, created_at, image_url,
           levantamentos!inner(cliente_id, titulo, data_voo),
           foco:focos_risco(id, status, desfecho, resolvido_em)`
        )
        .eq('levantamentos.cliente_id', clienteId)
        .is('deleted_at', null)
        .order('data_hora', { ascending: false })
        .limit(500);

      if (error) throw error;
      return enrichItensComFoco((data as Array<Record<string, unknown>>) || []);
    },

    /** Cria item manual via RPC (reutiliza ou cria levantamento MANUAL por dia/planejamento). */
    criarManual: async (params: {
      planejamento_id: string;
      data_voo: string;
      latitude?: number | null;
      longitude?: number | null;
      item?: string | null;
      risco?: string | null;
      acao?: string | null;
      score_final?: number | null;
      prioridade?: string | null;
      sla_horas?: number | null;
      endereco_curto?: string | null;
      endereco_completo?: string | null;
      image_url?: string | null;
      image_public_id?: string | null;
      maps?: string | null;
      waze?: string | null;
      data_hora?: string | null;
      tags?: string[] | null;
      peso?: number | null;
      payload?: Record<string, unknown> | null;
    }): Promise<{ levantamento_item: LevantamentoItem; levantamento_criado: boolean; levantamento_id: string }> => {
      const { data, error } = await supabase.rpc('criar_levantamento_item_manual', {
        p_planejamento_id: params.planejamento_id,
        p_data_voo: params.data_voo,
        p_latitude: params.latitude ?? null,
        p_longitude: params.longitude ?? null,
        p_item: params.item ?? null,
        p_risco: params.risco ?? null,
        p_acao: params.acao ?? null,
        p_score_final: params.score_final ?? null,
        p_prioridade: params.prioridade ?? null,
        p_sla_horas: params.sla_horas ?? null,
        p_endereco_curto: params.endereco_curto ?? null,
        p_endereco_completo: params.endereco_completo ?? null,
        p_image_url: params.image_url ?? null,
        p_image_public_id: params.image_public_id ?? null,
        p_maps: params.maps ?? null,
        p_waze: params.waze ?? null,
        p_data_hora: params.data_hora ?? null,
        p_tags: params.tags ?? null,
        p_peso: params.peso ?? null,
        p_payload: params.payload ?? null,
      });
      if (error) throw error;
      return data as { levantamento_item: LevantamentoItem; levantamento_criado: boolean; levantamento_id: string };
    },
    /**
     * Persiste observação no focos_risco vinculado ao item (campo adicionado na migration 20260923).
     * Busca o foco pelo origem_levantamento_item_id e atualiza o campo observacao.
     * Se o item não tiver foco vinculado (legado pré-migração), a chamada é silenciosa.
     */
    updateObservacaoAtendimento: async (levantamentoItemId: string, observacao: string | null): Promise<void> => {
      const { data: foco, error: errFoco } = await supabase
        .from('focos_risco')
        .select('id')
        .eq('origem_levantamento_item_id', levantamentoItemId)
        .is('deleted_at', null)
        .maybeSingle();
      if (errFoco) throw errFoco;
      if (!foco) return; // item pré-migração sem foco vinculado
      const { error } = await supabase
        .from('focos_risco')
        .update({ observacao })
        .eq('id', foco.id);
      if (error) throw error;
    },
    /**
     * @deprecated Colunas status_atendimento/acao_aplicada/data_resolucao removidas na migration 20260711.
     * Mantido como no-op para compatibilidade com o fallback de itens pré-migração sem foco vinculado.
     * Itens pré-migração sem foco_risco não têm mais suporte a transição de status.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateAtendimento: async (
      _levantamentoItemId: string,
      _payload: { status_atendimento: StatusAtendimento; acao_aplicada?: string | null }
    ): Promise<void> => {
      // no-op após drop das colunas
    },
    /**
     * Registra chegada do operador ao local.
     * Avança o foco_risco de 'suspeita' → 'em_triagem' (primeira ação de campo).
     * Coords não são mais persistidas — coluna checkin_lat/lng removida na migration 20260711.
     */
    registrarCheckin: async (
      levantamentoItemId: string,
      _coords?: { latitude: number; longitude: number }
    ): Promise<void> => {
      const foco = await api.focosRisco.byLevantamentoItem(levantamentoItemId);
      if (!foco) return; // item pré-migração sem foco vinculado
      if (foco.status === 'suspeita') {
        await api.focosRisco.transicionar(foco.id, 'em_triagem');
      }
    },
    /** Retorna o histórico de mudanças de status de um item, do mais recente ao mais antigo. */
    listStatusHistorico: async (levantamentoItemId: string): Promise<LevantamentoItemStatusHistorico[]> => {
      const { data, error } = await supabase
        .from('levantamento_item_status_historico')
        .select('*, usuario:usuarios(id, nome)')
        .eq('levantamento_item_id', levantamentoItemId)
        .order('alterado_em', { ascending: false });
      if (error) throw error;
      return data as LevantamentoItemStatusHistorico[];
    },

    /** Itens com localização em uma janela de tempo específica, para heatmap temporal. */
    listByClienteAndPeriod: async (clienteId: string, from: string, to: string): Promise<LevantamentoItem[]> => {
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select(`
          id, latitude, longitude, risco, item, created_at,
          levantamento:levantamentos!inner(cliente_id),
          foco:focos_risco(id, status, desfecho, resolvido_em)
        `)
        .eq('levantamento.cliente_id', clienteId)
        .is('deleted_at', null)
        .gte('created_at', from)
        .lte('created_at', to)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      if (error) throw error;
      return enrichItensComFoco((data as Array<Record<string, unknown>>) || []);
    },

    /**
     * Todas as detecções YOLO de um item (tabela levantamento_item_detecoes).
     * A detecção principal de negócio está em levantamento_itens.detection_bbox.
     * Retorna vazio para itens manuais ou anteriores à migration.
     */
    listDetecoes: async (itemId: string): Promise<LevantamentoItemDetecao[]> => {
      const { data, error } = await supabase
        .from('levantamento_item_detecoes')
        .select('*')
        .eq('levantamento_item_id', itemId)
        .order('ordem');
      if (error) throw error;
      return (data as LevantamentoItemDetecao[]) || [];
    },

    /** detection_bbox do item (YOLO) — leve, para overlay em listagens (ex.: triagem). */
    getDetectionBbox: async (itemId: string): Promise<LevantamentoItem['detection_bbox'] | null> => {
      const { data, error } = await supabase
        .from('levantamento_itens')
        .select('detection_bbox')
        .eq('id', itemId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      const row = data as { detection_bbox?: LevantamentoItem['detection_bbox'] } | null;
      return row?.detection_bbox ?? null;
    },
  },

  /** Evidências do atendimento por item (painel de detalhes em Meus itens). Fotos sobem para Cloudinary no front; aqui só insert com image_url. */
  evidenciasItem: {
    listByLevantamentoItem: async (levantamentoItemId: string): Promise<LevantamentoItemEvidencia[]> => {
      const { data, error } = await supabase
        .from('levantamento_item_evidencias')
        .select('*')
        .eq('levantamento_item_id', levantamentoItemId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as LevantamentoItemEvidencia[]) || [];
    },
    /** Insere evidência com image_url já hospedada no Cloudinary (upload é feito no front). */
    add: async (
      levantamentoItemId: string,
      imageUrl: string,
      legenda?: string | null
    ): Promise<LevantamentoItemEvidencia> => {
      const { data: inserted, error } = await supabase
        .from('levantamento_item_evidencias')
        .insert({
          levantamento_item_id: levantamentoItemId,
          image_url: imageUrl,
          legenda: legenda?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return inserted as LevantamentoItemEvidencia;
    },
  },

  clientes: {
    list: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    /** Lista todos os clientes incluindo inativos (para admin). */
    listAll: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    /** Retorna um único cliente pelo ID. */
    getById: async (id: string): Promise<Pick<Cliente, 'id' | 'nome'> | null> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('id', id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as Pick<Cliente, 'id' | 'nome'> | null;
    },
    /** Retorna campos de config UF/IBGE do cliente. */
    getConfig: async (id: string): Promise<Pick<Cliente, 'id' | 'uf' | 'ibge_municipio'> | null> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, uf, ibge_municipio')
        .eq('id', id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as Pick<Cliente, 'id' | 'uf' | 'ibge_municipio'> | null;
    },
    create: async (payload: Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Cliente> => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Cliente;
    },
    update: async (id: string, payload: Partial<Cliente>): Promise<void> => {
      const { error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    /** Resolve qual cliente (município) corresponde a uma coordenada GPS.
     *  Usado pelo portal público /denunciar — sem autenticação.
     *  Retorna null se nenhum município participante cobrir a localização. */
    resolverPorCoordenada: async (
      lat: number,
      lng: number,
    ): Promise<{ cliente_id: string; cliente_nome: string; cidade: string; uf: string; slug: string; metodo: string } | null> => {
      const { data, error } = await supabase.rpc('resolver_cliente_por_coordenada', {
        p_lat: lat,
        p_lng: lng,
      });
      if (error) throw error;
      const rows = data as Array<{ cliente_id: string; cliente_nome: string; cidade: string; uf: string; slug: string; encontrado: boolean; metodo: string }>;
      return rows && rows.length > 0 ? rows[0] : null;
    },
  },

  planejamentos: {
    listByCliente: async (clienteId: string): Promise<Planejamento[]> => {
      const { data, error } = await supabase
        .from('planejamento')
        .select('id, descricao, ativo')
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('data_planejamento', { ascending: false });

      if (error) throw error;
      return (data as Planejamento[]) || [];
    },
    /** Apenas planejamentos ativos (para criar item manual). */
    listAtivosByCliente: async (clienteId: string): Promise<Planejamento[]> => {
      const { data, error } = await supabase
        .from('planejamento')
        .select('id, descricao, ativo')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('data_planejamento', { ascending: false });

      if (error) throw error;
      return (data as Planejamento[]) || [];
    },
    /** Apenas planejamentos ativos com tipo MANUAL (aba Criar item). Aceita tipo_levantamento e tipo_entrada (legado). */
    listAtivosManuaisByCliente: async (clienteId: string): Promise<Planejamento[]> => {
      const { data, error } = await supabase
        .from('planejamento')
        .select('id, descricao, ativo, tipo_entrada, tipo_levantamento')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .is('deleted_at', null)
        .or('tipo_levantamento.ilike.manual,tipo_entrada.ilike.manual')
        .order('data_planejamento', { ascending: false });

      if (error) throw error;
      return (data as (Planejamento & { tipo_entrada?: string | null; tipo_levantamento?: string | null })[]) || [];
    },
    /** Lista planejamentos com join de cliente para admin. */
    listWithClienteByCliente: async (clienteId: string | null): Promise<(Planejamento & { cliente?: { id: string; nome: string; latitude_centro?: number | null; longitude_centro?: number | null } })[]> => {
      let query = supabase
        .from('planejamento')
        .select('*, cliente:clientes(id, nome, latitude_centro, longitude_centro)')
        .is('deleted_at', null)
        .order('data_planejamento', { ascending: false });
      if (clienteId) query = query.eq('cliente_id', clienteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data as (Planejamento & { cliente?: { id: string; nome: string; latitude_centro?: number | null; longitude_centro?: number | null } })[]) ?? [];
    },
    /** Cria ou atualiza um planejamento. Tenta com tipo_levantamento; fallback sem se coluna ausente. */
    upsert: async (payload: Record<string, unknown>, id?: string): Promise<void> => {
      const trySave = async (data: Record<string, unknown>) => {
        if (id) return supabase.from('planejamento').update(data).eq('id', id);
        return supabase.from('planejamento').insert(data);
      };
      let { error } = await trySave(payload);
      if (error && (error.message?.includes('tipo_entrada') || error.message?.includes('tipo_levantamento'))) {
        const { tipo_entrada: _te, tipo_levantamento: _tl, ...fallback } = payload;
        const res = await trySave(fallback);
        error = res.error;
      }
      if (error) throw error;
    },
    /** Remove um planejamento pelo id. */
    remove: async (id: string): Promise<void> => {
      const { error } = await supabase.from('planejamento').delete().eq('id', id);
      if (error) throw error;
    },
    /** Lista voos vinculados a um planejamento. */
    voosByPlanejamento: async (planejamentoId: string): Promise<Voo[]> => {
      const { data, error } = await supabase
        .from('voos')
        .select('*')
        .eq('planejamento_id', planejamentoId)
        .order('inicio', { ascending: false });
      if (error) throw error;
      return (data as Voo[]) ?? [];
    },
  },

  tags: {
    list: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, slug, label')
        .order('slug');

      if (error) throw error;
      return (data as Tag[]) || [];
    },
  },

  /** Upload e exclusão de imagens no Cloudinary via Edge (backend). */
  cloudinary: {
    /** Envia a imagem para a Edge Function, que faz upload no Cloudinary (Basic Auth). */
    uploadImage: async (file: File, folder = 'evidencias'): Promise<{ secure_url: string; public_id: string }> => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const b = dataUrl.split(',')[1];
          if (b) { resolve(b); } else { reject(new Error('Leitura do arquivo falhou')); }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const url = `${supabaseUrl}/functions/v1/cloudinary-upload-image`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          file_base64: base64,
          content_type: file.type || 'image/jpeg',
          folder,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        secure_url?: string;
        public_id?: string;
        error?: string;
      };
      if (!res.ok) {
        const msg = data?.error || res.statusText || 'Edge Function retornou erro';
        throw new Error(msg);
      }
      if (!data.secure_url) throw new Error(data?.error || 'Upload falhou');
      return { secure_url: data.secure_url, public_id: data.public_id || '' };
    },
    /** Exclui imagem do Cloudinary pelo public_id (Edge Function). */
    deleteImage: async (publicId: string): Promise<void> => {
      const { error } = await supabase.functions.invoke('cloudinary-delete-image', {
        body: { public_id: publicId },
      });
      if (error) throw error;
    },
  },

  regioes: {
    listByCliente: async (clienteId: string): Promise<Regiao[]> => {
      const { data, error } = await supabase
        .from('regioes')
        .select('id, regiao, cliente_id, latitude, longitude, area, created_at, updated_at')
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('regiao');
      if (error) throw error;
      return (data as Regiao[]) || [];
    },
    /** Lista regiões com join de cliente — para AdminRegioes. */
    listAll: async (clienteId?: string): Promise<(Regiao & { cliente?: { id: string; nome: string } })[]> => {
      let q = supabase
        .from('regioes')
        .select('*, cliente:clientes(id, nome)')
        .order('regiao');
      if (clienteId) q = q.eq('cliente_id', clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as (Regiao & { cliente?: { id: string; nome: string } })[]) || [];
    },
    create: async (payload: Omit<Regiao, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<string> => {
      const { data, error } = await supabase.from('regioes').insert(payload).select('id').single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    update: async (id: string, payload: Partial<Regiao>): Promise<void> => {
      const { error } = await supabase.from('regioes').update(payload).eq('id', id);
      if (error) throw error;
    },
    remove: async (id: string): Promise<void> => {
      const { error } = await supabase.from('regioes').delete().eq('id', id);
      if (error) throw error;
    },
    bulkInsert: async (rows: Omit<Regiao, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>[]): Promise<void> => {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('regioes').insert(rows.slice(i, i + CHUNK));
        if (error) throw error;
      }
    },
  },

  /** CRUD de runs e itens pluviométricos operacionais. */
  pluvioOperacional: {
    listItems: async (runId: string): Promise<Record<string, unknown>[]> => {
      const { data, error } = await supabase
        .from('pluvio_operacional_item')
        .select('*, regiao:regioes(id, regiao)')
        .eq('run_id', runId)
        .order('prioridade_operacional');
      if (error) throw error;
      return data || [];
    },
    /** Cria run e retorna o id gerado — para importação em lote. */
    createRunGetId: async (payload: Record<string, unknown>): Promise<string> => {
      const { data, error } = await supabase
        .from('pluvio_operacional_run')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    listRuns: async (clienteId?: string): Promise<Record<string, unknown>[]> => {
      let q = supabase.from('pluvio_operacional_run').select('*').order('dt_ref', { ascending: false });
      if (clienteId) q = q.eq('cliente_id', clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    createRun: async (payload: Record<string, unknown>): Promise<void> => {
      const { error } = await supabase.from('pluvio_operacional_run').insert(payload);
      if (error) throw error;
    },
    deleteRun: async (id: string): Promise<void> => {
      const { error } = await supabase.from('pluvio_operacional_run').delete().eq('id', id);
      if (error) throw error;
    },
    updateRunTotal: async (runId: string): Promise<void> => {
      const { count } = await supabase
        .from('pluvio_operacional_item')
        .select('id', { count: 'exact', head: true })
        .eq('run_id', runId);
      await supabase
        .from('pluvio_operacional_run')
        .update({ total_bairros: count ?? 0 })
        .eq('id', runId);
    },
    upsertItem: async (id: string | null, payload: Record<string, unknown>): Promise<void> => {
      const { error } = id
        ? await supabase.from('pluvio_operacional_item').update(payload).eq('id', id)
        : await supabase.from('pluvio_operacional_item').insert(payload);
      if (error) throw error;
    },
    deleteItem: async (id: string): Promise<void> => {
      const { error } = await supabase.from('pluvio_operacional_item').delete().eq('id', id);
      if (error) throw error;
    },
    bulkInsertItems: async (rows: Record<string, unknown>[]): Promise<void> => {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('pluvio_operacional_item').insert(rows.slice(i, i + CHUNK));
        if (error) throw error;
      }
    },
  },

  /** CRUD de registros de risco pluviométrico por região. */
  pluvioRisco: {
    /** Lista registros filtrando por lista de regiao_ids (pluvio_risco não tem cliente_id direto). */
    listByRegioes: async (regIds: string[]): Promise<Record<string, unknown>[]> => {
      if (regIds.length === 0) return [];
      const { data, error } = await supabase
        .from('pluvio_risco')
        .select('*, regiao:regioes(id, regiao)')
        .in('regiao_id', regIds)
        .order('dt_ref', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    upsert: async (id: string | null, payload: Record<string, unknown>): Promise<void> => {
      const { error } = id
        ? await supabase.from('pluvio_risco').update(payload).eq('id', id)
        : await supabase.from('pluvio_risco').insert(payload);
      if (error) throw error;
    },
    remove: async (id: string): Promise<void> => {
      const { error } = await supabase.from('pluvio_risco').delete().eq('id', id);
      if (error) throw error;
    },
    bulkInsert: async (rows: Record<string, unknown>[]): Promise<void> => {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('pluvio_risco').insert(rows.slice(i, i + CHUNK));
        if (error) throw error;
      }
    },
  },

  sla: {
    /** Full SLA list for a client (pluvio + levantamento), filtered por cliente_id. */
    listByCliente: async (clienteId: string): Promise<SlaOperacional[]> => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from('sla_operacional')
            .select(
              `*,
              item:pluvio_operacional_item(
                id, bairro_nome, classificacao_risco, situacao_ambiental,
                chuva_24h_mm, tendencia, prioridade_operacional, run_id,
                run:pluvio_operacional_run(id, dt_ref, cliente_id)
              ),
              levantamento_item:levantamento_itens(
                id, item, risco, prioridade, endereco_curto,
                levantamento:levantamentos(id, cliente_id)
              )`
            )
            .eq('cliente_id', clienteId)
            .order('prazo_final', { ascending: true })
        );

        if (error) throw error;
        return (data || []) as unknown as SlaOperacional[];
      } catch (error) {
        if (isRetryableSupabaseError(error)) {
          console.warn('[api.sla.listByCliente] Supabase temporariamente indisponível; retornando lista vazia.');
          return [];
        }
        throw error;
      }
    },

    /** SLA panel list with operador join, role-based filter, server-side client filter. */
    listForPanel: async (clienteId: string, operadorId?: string): Promise<SlaOperacional[]> => {
      try {
        const { data, error } = await withRetry(async () => {
          let q = supabase
            .from('sla_operacional')
            .select(
              `*,
              item:pluvio_operacional_item(
                id, bairro_nome, classificacao_risco, situacao_ambiental,
                chuva_24h_mm, tendencia, prioridade_operacional, run_id,
                run:pluvio_operacional_run(id, dt_ref, cliente_id)
              ),
              levantamento_item:levantamento_itens(
                id, item, risco, prioridade, endereco_curto,
                levantamento:levantamentos(id, cliente_id)
              ),
              operador:usuarios(id, nome, email)`
            )
            .order('prazo_final', { ascending: true });

          if (operadorId) q = q.eq('operador_id', operadorId);
          if (clienteId) q = q.eq('cliente_id', clienteId);
          return q;
        });
        if (error) throw error;
        return (data || []) as unknown as SlaOperacional[];
      } catch (error) {
        if (isRetryableSupabaseError(error)) {
          console.warn('[api.sla.listForPanel] Supabase temporariamente indisponível; retornando lista vazia.');
          return [];
        }
        throw error;
      }
    },

    /** Avança o status operacional de um SLA (ex: pendente → em_atendimento). */
    updateStatus: async (slaId: string, updates: { status: string; iniciado_em?: string }): Promise<void> => {
      const { error } = await supabase.from('sla_operacional').update(updates).eq('id', slaId);
      if (error) throw error;
    },

    /**
     * Reabrir SLA concluído (volta para pendente; apenas admin/supervisor na UI).
     * QW-06: usa RPC reabrir_sla() que recalcula prazo_final a partir de now(),
     * evitando que o item fique imediatamente vencido com o prazo original já expirado.
     */
    reabrir: async (slaId: string): Promise<void> => {
      const { error } = await supabase.rpc('reabrir_sla', { p_sla_id: slaId });
      if (error) throw error;
    },

    /**
     * Marca SLAs expirados (prazo_final < now) como 'vencido'.
     * Chamado periodicamente pelo hook useSlaAlerts. Retorna a quantidade atualizada.
     */
    verificarVencidos: async (clienteId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('marcar_slas_vencidos', {
        p_cliente_id: clienteId,
      });
      if (error) logAndThrow(error, 'sla.verificarVencidos', { clienteId });
      return typeof data === 'number' ? data : 0;
    },

    /**
     * Escala um SLA para a próxima prioridade mais alta e recalcula o prazo.
     * Retorna { escalado, prioridade_anterior, prioridade_nova, sla_horas } ou
     * { escalado: false, mensagem } quando já está no topo.
     */
    escalar: async (slaId: string): Promise<{ escalado: boolean; prioridade_nova?: string; sla_horas?: number; mensagem?: string }> => {
      const { data, error } = await supabase.rpc('escalar_sla_operacional', {
        p_sla_id: slaId,
      });
      if (error) logAndThrow(error, 'sla.escalar', { slaId });
      return data as { escalado: boolean; prioridade_nova?: string; sla_horas?: number; mensagem?: string };
    },

    /** Count of pending/em_atendimento SLAs for a client (pluvio + levantamento). */
    pendingCount: async (clienteId: string): Promise<number> => {
      try {
        const { count, error } = await withRetry(() =>
          supabase
            .from('sla_operacional')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', clienteId)
            .in('status', ['pendente', 'em_atendimento'])
        );

        if (error) throw error;
        return count ?? 0;
      } catch (error) {
        if (isRetryableSupabaseError(error)) {
          console.warn('[api.sla.pendingCount] Supabase temporariamente indisponível; retornando 0.');
          return 0;
        }
        throw error;
      }
    },

    /** QW-09 Correção 1: Busca erros de criação de SLA para exibir no AdminSla. */
    errosCriacao: async (clienteId: string): Promise<Array<{ id: string; erro: string; criado_em: string }>> => {
      const { data, error } = await supabase
        .from('sla_erros_criacao')
        .select('id, erro, criado_em')
        .eq('cliente_id', clienteId)
        .order('criado_em', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Array<{ id: string; erro: string; criado_em: string }>;
    },

    /** Lista runs pluvio (dt_ref) para o seletor de geração de SLA no AdminSla. */
    listRunsByCliente: async (clienteId: string): Promise<Array<{ id: string; dt_ref: string }>> => {
      const { data, error } = await supabase
        .from('pluvio_operacional_run')
        .select('id, dt_ref')
        .eq('cliente_id', clienteId)
        .order('dt_ref', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as Array<{ id: string; dt_ref: string }>;
    },

    /** Lista SLAs com join completo de item, levantamento_item e operador para o AdminSla. */
    listWithJoins: async (clienteId: string | null): Promise<SlaOperacional[]> => {
      let q = supabase
        .from('sla_operacional')
        .select(`
          *,
          item:pluvio_operacional_item(
            id, bairro_nome, classificacao_risco, situacao_ambiental,
            prioridade_operacional, run_id,
            run:pluvio_operacional_run(id, dt_ref, cliente_id)
          ),
          levantamento_item:levantamento_itens(
            id, item, risco, prioridade, endereco_curto,
            levantamento:levantamentos(id, cliente_id)
          ),
          operador:usuarios(id, nome, email)
        `)
        .order('prazo_final', { ascending: true });
      if (clienteId) q = q.eq('cliente_id', clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SlaOperacional[];
    },

    /** Lista operadores (usuarios) de um cliente para o filtro de responsável no AdminSla. */
    listOperadoresByCliente: async (clienteId: string | null): Promise<Array<{ id: string; nome: string; email: string }>> => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as Array<{ id: string; nome: string; email: string }>;
    },

    /** Atribui um operador ao SLA; avança para em_atendimento se estiver pendente. */
    atribuirOperador: async (slaId: string, operadorId: string | null, avancarStatus: boolean): Promise<void> => {
      const campos: Record<string, unknown> = { operador_id: operadorId || null };
      if (avancarStatus) campos.status = 'em_atendimento';
      const { error } = await supabase.from('sla_operacional').update(campos).eq('id', slaId);
      if (error) throw error;
    },
    /** Conclui manualmente um SLA, marcando concluido_em e violado se necessário. */
    concluirManualmente: async (slaId: string, violado: boolean): Promise<void> => {
      const campos: Record<string, unknown> = {
        status: 'concluido',
        concluido_em: new Date().toISOString(),
        ...(violado ? { violado: true } : {}),
      };
      const { error } = await supabase.from('sla_operacional').update(campos).eq('id', slaId);
      if (error) throw error;
    },

    /** Gera SLAs para um run pluvio. Retorna a quantidade de SLAs criados. */
    gerarSlas: async (runId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('gerar_slas_para_run', { p_run_id: runId });
      if (error) throw error;
      return typeof data === 'number' ? data : 0;
    },
  },

  operacoes: {
    /** Ensure an operação exists and is em_andamento for a given SLA item. */
    ensureEmAndamento: async (
      clienteId: string,
      itemOperacionalId: string,
      responsavelId: string,
      prioridade: string
    ): Promise<void> => {
      const { data: existing } = await supabase
        .from('operacoes')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('item_operacional_id', itemOperacionalId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('operacoes')
          .update({ status: 'em_andamento', responsavel_id: responsavelId, iniciado_em: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('operacoes').insert({
          cliente_id: clienteId,
          item_operacional_id: itemOperacionalId,
          tipo_vinculo: 'operacional',
          status: 'em_andamento',
          prioridade,
          responsavel_id: responsavelId,
          iniciado_em: new Date().toISOString(),
        });
      }
    },

    /** Status + prioridade rows for aggregation widgets. */
    statsByCliente: async (clienteId: string): Promise<OperacaoStat[]> => {
      const { data, error } = await supabase
        .from('operacoes')
        .select('status, prioridade')
        .eq('cliente_id', clienteId);

      if (error) throw error;
      return (data as OperacaoStat[]) || [];
    },

    /** Create a pending correction task for a levantamento item (no operator assigned yet). */
    criarParaItem: async (params: {
      clienteId: string;
      itemLevantamentoId: string;
      prioridade: string;
      observacao?: string;
    }): Promise<void> => {
      const { data: existing } = await supabase
        .from('operacoes')
        .select('id')
        .eq('item_levantamento_id', params.itemLevantamentoId)
        .eq('cliente_id', params.clienteId)
        .in('status', ['pendente', 'em_andamento'])
        .limit(1);

      if (existing?.length) {
        throw new Error('ALREADY_EXISTS');
      }

      const { error } = await supabase.from('operacoes').insert({
        cliente_id: params.clienteId,
        item_levantamento_id: params.itemLevantamentoId,
        tipo_vinculo: 'levantamento',
        status: 'pendente',
        prioridade: params.prioridade,
        observacao: params.observacao ?? null,
      });

      if (error) throw error;
    },

    /** Send a field team to a levantamento item (creates operacao em_andamento). */
    enviarEquipeParaItem: async (params: {
      clienteId: string;
      itemLevantamentoId: string;
      prioridade: string;
      responsavelId?: string;
      observacao?: string;
    }): Promise<void> => {
      const payload: Record<string, unknown> = {
        cliente_id: params.clienteId,
        item_levantamento_id: params.itemLevantamentoId,
        tipo_vinculo: 'levantamento',
        status: 'em_andamento',
        prioridade: params.prioridade,
        observacao: params.observacao ?? null,
        iniciado_em: new Date().toISOString(),
      };

      if (params.responsavelId) payload.responsavel_id = params.responsavelId;

      const { error } = await supabase.from('operacoes').insert(payload);
      if (error) throw error;
    },

    /** Mark a levantamento item as resolved: update/create operacao concluida + update item status. */
    resolverItem: async (params: {
      clienteId: string;
      itemLevantamentoId: string;
      prioridade: string;
      observacao?: string;
    }): Promise<void> => {
      const { data: existing } = await supabase
        .from('operacoes')
        .select('id')
        .eq('item_levantamento_id', params.itemLevantamentoId)
        .eq('cliente_id', params.clienteId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('operacoes')
          .update({ status: 'concluido', concluido_em: new Date().toISOString() })
          .eq('id', (existing as { id: string }[])[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('operacoes').insert({
          cliente_id: params.clienteId,
          item_levantamento_id: params.itemLevantamentoId,
          tipo_vinculo: 'levantamento',
          status: 'concluido',
          prioridade: params.prioridade,
          observacao: params.observacao ?? null,
          iniciado_em: new Date().toISOString(),
          concluido_em: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },

    /**
     * Resolve item operacional.
     * Compatibilidade pós-migração: status de atendimento saiu de levantamento_itens
     * e passou a ser controlado por focos_risco.
     */
    resolverStatusItem: async (itemId: string): Promise<void> => {
      const foco = await api.focosRisco.byLevantamentoItem(itemId);
      if (!foco) return; // item legado sem foco vinculado
      if (foco.status !== 'resolvido') {
        await api.focosRisco.transicionar(foco.id, 'resolvido');
      }
    },

    /** List all operacoes for a client with resolved vinculo names (bairro/item/regiao). */
    listarComVinculos: async (clienteId: string): Promise<OperacaoComVinculo[]> => {
      const { data: rows, error } = await supabase
        .from('operacoes')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ops = (rows as OperacaoComVinculo[]) || [];
      const opIds = ops.filter(o => o.item_operacional_id).map(o => o.item_operacional_id!);
      const levIds = ops.filter(o => o.item_levantamento_id).map(o => o.item_levantamento_id!);
      const regIds = ops.filter(o => o.regiao_id).map(o => o.regiao_id!);

      const [opRes, levRes, regRes] = await Promise.all([
        opIds.length > 0
          ? supabase.from('pluvio_operacional_item').select('id, bairro_nome').in('id', opIds)
          : { data: [] },
        levIds.length > 0
          ? supabase.from('levantamento_itens').select('id, item').in('id', levIds)
          : { data: [] },
        regIds.length > 0
          ? supabase.from('regioes').select('id, regiao').in('id', regIds)
          : { data: [] },
      ]);

      const opMap = new Map(
        ((opRes.data as { id: string; bairro_nome: string }[]) || []).map(r => [r.id, r.bairro_nome])
      );
      const levMap = new Map(
        ((levRes.data as { id: string; item: string }[]) || []).map(r => [r.id, r.item])
      );
      const regMap = new Map(
        ((regRes.data as { id: string; regiao: string }[]) || []).map(r => [r.id, r.regiao])
      );

      for (const op of ops) {
        if (op.item_operacional_id) op.vinculo_nome = opMap.get(op.item_operacional_id) || op.item_operacional_id;
        else if (op.item_levantamento_id) op.vinculo_nome = levMap.get(op.item_levantamento_id) || op.item_levantamento_id;
        else if (op.regiao_id) op.vinculo_nome = regMap.get(op.regiao_id) || op.regiao_id;
      }

      return ops;
    },

    /** Upsert (create or update) an operacao record. */
    salvar: async (params: {
      clienteId: string;
      id?: string;
      status: string;
      prioridade?: string | null;
      responsavel_id?: string | null;
      observacao?: string | null;
      prevStatus?: string;
    }): Promise<void> => {
      const payload: Record<string, unknown> = {
        cliente_id: params.clienteId,
        status: params.status,
        prioridade: params.prioridade ?? null,
        responsavel_id: params.responsavel_id ?? null,
        observacao: params.observacao ?? null,
      };

      if (params.id) {
        // Update: set timing fields when transitioning into em_andamento/concluido
        if (params.prevStatus !== 'em_andamento' && params.status === 'em_andamento') {
          payload.iniciado_em = new Date().toISOString();
        }
        if (params.prevStatus !== 'concluido' && params.status === 'concluido') {
          payload.concluido_em = new Date().toISOString();
        }
        const { error } = await supabase.from('operacoes').update(payload).eq('id', params.id);
        if (error) throw error;
      } else {
        // Insert: set timing fields based on initial status
        if (params.status === 'em_andamento') payload.iniciado_em = new Date().toISOString();
        if (params.status === 'concluido') payload.concluido_em = new Date().toISOString();
        const { error } = await supabase.from('operacoes').insert(payload);
        if (error) throw error;
      }
    },

    /** Delete an operacao by id. */
    remover: async (id: string): Promise<void> => {
      const { error } = await supabase.from('operacoes').delete().eq('id', id);
      if (error) throw error;
    },

    /** Quick-update the status of an operacao, setting timing fields as needed. */
    atualizarStatus: async (id: string, newStatus: string): Promise<void> => {
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'em_andamento') payload.iniciado_em = new Date().toISOString();
      if (newStatus === 'concluido') payload.concluido_em = new Date().toISOString();
      const { error } = await supabase.from('operacoes').update(payload).eq('id', id);
      if (error) throw error;
    },

    /** Lista operações de um foco com evidências (fotos antes/depois). */
    listByFoco: async (focoId: string, clienteId: string) => {
      const { data, error } = await supabase
        .from('operacoes')
        .select('*, evidencias:operacao_evidencias(id, image_url, legenda, public_id)')
        .eq('foco_risco_id', focoId)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /** Lista operadores (usuários) de um cliente — para seleção de responsável. */
    listOperadores: async (clienteId: string): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },

    /** Bulk insert de operações em chunks de 500. */
    bulkInsert: async (rows: Record<string, unknown>[]): Promise<void> => {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('operacoes').insert(rows.slice(i, i + CHUNK));
        if (error) throw error;
      }
    },
    /** IDs de item_operacional_id já com operação aberta (pendente/em_andamento). */
    listExistingItemIds: async (clienteId: string, itemIds: string[]): Promise<string[]> => {
      if (itemIds.length === 0) return [];
      const { data } = await supabase
        .from('operacoes')
        .select('item_operacional_id')
        .eq('cliente_id', clienteId)
        .in('status', ['pendente', 'em_andamento'])
        .in('item_operacional_id', itemIds);
      return ((data || []) as { item_operacional_id: string }[]).map(e => e.item_operacional_id);
    },

    /** Cancela uma operação, marcando status e concluido_em. */
    cancelar: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('operacoes')
        .update({ status: 'cancelado', concluido_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    /** Resolve um foco de risco via RPC de transição de estado. */
    resolverStatusItem: async (focoId: string): Promise<void> => {
      const { error } = await supabase.rpc('rpc_transicionar_foco_risco', {
        foco_id: focoId,
        novo_status: 'resolvido',
      });
      if (error) throw error;
    },

    /** Upsert genérico de operação — delega para salvar(). */
    upsert: async (params: {
      clienteId: string;
      id?: string;
      status: string;
      prioridade?: string | null;
      responsavel_id?: string | null;
      observacao?: string | null;
      prevStatus?: string;
    }): Promise<void> => {
      const payload: Record<string, unknown> = {
        cliente_id: params.clienteId,
        status: params.status,
        prioridade: params.prioridade ?? null,
        responsavel_id: params.responsavel_id ?? null,
        observacao: params.observacao ?? null,
      };
      if (params.id) {
        const { error } = await supabase.from('operacoes').update(payload).eq('id', params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('operacoes').insert(payload);
        if (error) throw error;
      }
    },

    /** Conclui a operação vinculada a um item, marcando concluido_em. */
    concluirParaItem: async (itemId: string): Promise<void> => {
      const { error } = await supabase
        .from('operacoes')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('item_levantamento_id', itemId)
        .in('status', ['pendente', 'em_andamento']);
      if (error) throw error;
    },
  },

  map: {
    /** Full map data bundle for MapaInspecao — items, cliente area, planejamentos, regioes + pluvio. */
    fullDataByCliente: async (clienteId: string) => {
      const [itemsRes, clienteRes, planejRes, regioesRes] = await Promise.all([
        supabase
          .from('levantamento_itens')
          .select('*, levantamento:levantamentos!inner(titulo, cliente_id), drone:drones(marca, modelo)')
          .eq('levantamento.cliente_id', clienteId)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          // QW-08: limite de segurança — evita carregar histórico ilimitado em clientes com
          // muitos levantamentos. O HeatmapLayer filtra pelo viewport, então 2000 pontos
          // por ordem de data_hora recente são suficientes para qualquer visualização.
          .order('data_hora', { ascending: false })
          .limit(2000),
        supabase.from('clientes').select('area').eq('id', clienteId).maybeSingle(),
        supabase
          .from('planejamento')
          .select('id, descricao, area')
          .eq('cliente_id', clienteId)
          .not('area', 'is', null),
        supabase
          .from('regioes')
          .select('id, regiao, area')
          .eq('cliente_id', clienteId)
          .not('area', 'is', null),
      ]);

      if (itemsRes.error && !itemsRes.data) throw itemsRes.error;

      const regIds = ((regioesRes.data as Regiao[]) ?? []).map((r) => r.id);
      const pluvioMap: Record<string, PluvioRisco> = {};
      if (regIds.length > 0) {
        const { data: pluvioData } = await supabase
          .from('pluvio_risco')
          .select('*')
          .in('regiao_id', regIds)
          .order('dt_ref', { ascending: false });
        if (pluvioData) {
          for (const p of pluvioData as PluvioRisco[]) {
            if (!pluvioMap[p.regiao_id]) pluvioMap[p.regiao_id] = p;
          }
        }
      }

      return {
        itens: (itemsRes.data ?? []) as LevantamentoItem[],
        clienteArea: (clienteRes.data?.area ?? null) as Record<string, unknown> | null,
        planejamentos: (planejRes.data ?? []) as Planejamento[],
        regioes: (regioesRes.data ?? []) as Regiao[],
        pluvioRiscoMap: pluvioMap,
      };
    },

    /** Item operation statuses for map markers. */
    itemStatusesByCliente: async (clienteId: string): Promise<Record<string, string>> => {
      const { data } = await supabase
        .from('operacoes')
        .select('item_levantamento_id, status')
        .eq('cliente_id', clienteId)
        .not('item_levantamento_id', 'is', null);

      const statusMap: Record<string, string> = {};
      for (const op of (data as { item_levantamento_id: string; status: string }[]) ?? []) {
        const existing = statusMap[op.item_levantamento_id];
        if (!existing || op.status === 'concluido' || (op.status === 'em_andamento' && existing !== 'concluido')) {
          statusMap[op.item_levantamento_id] = op.status;
        }
      }
      return statusMap;
    },
  },

  pluvio: {
    /** Latest pluvio_risco per region for a client, merged with region data. */
    riscoByCliente: async (clienteId: string): Promise<RegiaoComRisco[]> => {
      const { data: regioes, error: e1 } = await supabase
        .from('regioes')
        .select('id, regiao, cliente_id, latitude, longitude, area, created_at, updated_at')
        .eq('cliente_id', clienteId)
        .order('regiao');

      if (e1) throw e1;
      const regs = (regioes as Regiao[]) ?? [];
      if (regs.length === 0) return [];

      const regIds = regs.map((r) => r.id);
      let pluvioData: unknown[] | null = null;
      try {
        const result = await withRetry(() =>
          supabase
            .from('pluvio_risco')
            .select('*')
            .in('regiao_id', regIds)
            .order('dt_ref', { ascending: false })
        );
        if (result.error) throw result.error;
        pluvioData = result.data;
      } catch (error) {
        if (isRetryableSupabaseError(error)) {
          console.warn('[api.pluvio.riscoByCliente] Supabase temporariamente indisponível; retornando regiões sem risco.');
          return regs.map((r) => ({ ...r }));
        }
        throw error;
      }

      const riscoMap: Record<string, PluvioRisco> = {};
      for (const p of (pluvioData as PluvioRisco[]) ?? []) {
        if (!riscoMap[p.regiao_id]) riscoMap[p.regiao_id] = p;
      }

      return regs.map((r) => ({ ...r, risco: riscoMap[r.id] }));
    },

    /** Latest pluvio_operacional_run with sorted items for a client. */
    latestRunByCliente: async (clienteId: string): Promise<PluvioRunWithItems | null> => {
      const { data: runData, error: runErr } = await supabase
        .from('pluvio_operacional_run')
        .select('id, dt_ref, total_bairros')
        .eq('cliente_id', clienteId)
        .order('dt_ref', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (runErr) throw runErr;
      if (!runData) return null;

      const { data: items } = await supabase
        .from('pluvio_operacional_item')
        .select(
          'id, bairro_nome, classificacao_risco, prioridade_operacional, chuva_24h_mm, tendencia, prob_final_min, prob_final_max, prazo_acao'
        )
        .eq('run_id', runData.id)
        .order('created_at');

      const PRIORIDADE_ORDER = ['Urgente', 'Alta', 'Média', 'Baixa', 'Monitoramento'];
      const sorted = ((items ?? []) as PluvioRunWithItems['items']).sort((a, b) => {
        const ai = PRIORIDADE_ORDER.indexOf(a.prioridade_operacional);
        const bi = PRIORIDADE_ORDER.indexOf(b.prioridade_operacional);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

      return { ...runData, items: sorted };
    },
  },

  /** Catálogo de ações corretivas configurável por cliente. */
  planoAcaoCatalogo: {
    /** Lista ações ativas do cliente, ordenadas por `ordem`. Filtro opcional por tipo_item. */
    listByCliente: async (clienteId: string, tipoItem?: string | null): Promise<PlanoAcaoCatalogo[]> => {
      let query = supabase
        .from('plano_acao_catalogo')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .order('ordem', { ascending: true });

      if (tipoItem) {
        // Retorna ações do tipo específico + ações genéricas (tipo_item NULL)
        query = query.or(`tipo_item.eq.${tipoItem},tipo_item.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PlanoAcaoCatalogo[];
    },

    /** Lista todas as ações (inclusive inativas) para gerenciamento pelo admin. */
    listAllByCliente: async (clienteId: string): Promise<PlanoAcaoCatalogo[]> => {
      const { data, error } = await supabase
        .from('plano_acao_catalogo')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data as PlanoAcaoCatalogo[];
    },

    create: async (payload: Pick<PlanoAcaoCatalogo, 'cliente_id' | 'label' | 'descricao' | 'tipo_item' | 'ordem'>): Promise<PlanoAcaoCatalogo> => {
      const { data, error } = await supabase
        .from('plano_acao_catalogo')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as PlanoAcaoCatalogo;
    },

    update: async (id: string, payload: Partial<Pick<PlanoAcaoCatalogo, 'label' | 'descricao' | 'tipo_item' | 'ativo' | 'ordem'>>): Promise<void> => {
      const { error } = await supabase
        .from('plano_acao_catalogo')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },

    remove: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('plano_acao_catalogo')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  },

  /**
   * Clusters de focos recorrentes.
   * 4B: sistema legado (levantamento_item_recorrencia) removido.
   * Fonte: focos_risco agrupados por endereco_normalizado na janela de 30 dias.
   */
  recorrencias: {
    /** Lista endereços com 2+ focos nos últimos 30 dias — compatível com RecorrenciaAtiva. */
    listAtivasByCliente: async (clienteId: string): Promise<RecorrenciaAtiva[]> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('focos_risco')
        .select('id, endereco_normalizado, imovel_id, suspeita_em, prioridade, deleted_at')
        .eq('cliente_id', clienteId)
        .gte('suspeita_em', since)
        .is('deleted_at', null)
        .order('suspeita_em', { ascending: false });
      if (error) throw error;

      // Agrupar por endereco_normalizado; retornar apenas locais com >= 2 focos
      const grouped = new Map<string, RecorrenciaAtiva>();
      for (const foco of (data || [])) {
        const key = foco.endereco_normalizado || foco.imovel_id || foco.id;
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: foco.imovel_id || foco.id,
            cliente_id: clienteId,
            endereco_ref: foco.endereco_normalizado ?? null,
            latitude_ref: null,
            longitude_ref: null,
            total_ocorrencias: 1,
            primeira_ocorrencia_id: foco.id,
            ultima_ocorrencia_id: foco.id,
            primeira_ocorrencia_em: foco.suspeita_em,
            ultima_ocorrencia_em: foco.suspeita_em,
            ultimo_item: null,
            ultimo_risco: null,
            ultima_prioridade: foco.prioridade ?? null,
            ultimo_endereco_curto: foco.endereco_normalizado ?? null,
            ultima_image_url: null,
          } as RecorrenciaAtiva);
        } else {
          const r = grouped.get(key)!;
          r.total_ocorrencias++;
          r.ultima_ocorrencia_em = foco.suspeita_em;
          r.ultima_ocorrencia_id = foco.id;
        }
      }
      return Array.from(grouped.values()).filter(r => r.total_ocorrencias >= 2);
    },

    /** Contagem de endereços com 2+ focos nos últimos 30 dias. */
    countAtivasByCliente: async (clienteId: string): Promise<number> => {
      const list = await api.recorrencias.listAtivasByCliente(clienteId);
      return list.length;
    },

    /** @deprecated Sistema legado removido (4B). Retorna vazio. */
    listItensByRecorrencia: async (_recorrenciaId: string): Promise<LevantamentoItemRecorrencia[]> => {
      return [];
    },
  },

  /** Configuração das classes YOLO por cliente — ação, risco e peso por item_key. */
  yoloClassConfig: {
    listByCliente: async (clienteId: string): Promise<SentinelaYoloClassConfig[]> => {
      const { data, error } = await supabase
        .from('sentinela_yolo_class_config')
        .select('id, cliente_id, item_key, item, risco, peso, acao, is_active')
        .eq('cliente_id', clienteId)
        .eq('is_active', true)
        .order('item_key');
      if (error) throw error;
      return (data as SentinelaYoloClassConfig[]) || [];
    },
  },

  /** Feriados municipais/nacionais por cliente. Usados no cálculo de SLA com horário comercial. */
  slaFeriados: {
    listByCliente: async (clienteId: string): Promise<SlaFeriado[]> => {
      const { data, error } = await supabase
        .from('sla_feriados')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data', { ascending: true });
      if (error) throw error;
      return data as SlaFeriado[];
    },

    create: async (payload: Pick<SlaFeriado, 'cliente_id' | 'data' | 'descricao' | 'nacional'>): Promise<SlaFeriado> => {
      const { data, error } = await supabase
        .from('sla_feriados')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as SlaFeriado;
    },

    remove: async (id: string): Promise<void> => {
      const { error } = await supabase.from('sla_feriados').delete().eq('id', id);
      if (error) throw error;
    },

    seedNacionais: async (clienteId: string): Promise<void> => {
      const { error } = await supabase.rpc('seed_sla_feriados_nacionais', { p_cliente_id: clienteId });
      if (error) throw error;
    },
  },

  /** SLAs iminentes — nos últimos 20% do prazo, ainda não vencidos. */
  slaIminentes: {
    listByCliente: async (clienteId: string): Promise<SlaIminente[]> => {
      const { data, error } = await supabase
        .from('v_slas_iminentes')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('minutos_restantes', { ascending: true });
      if (error) throw error;
      return data as SlaIminente[];
    },

    countByCliente: async (clienteId: string): Promise<number> => {
      const { count, error } = await supabase
        .from('v_slas_iminentes')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', clienteId);
      if (error) throw error;
      return count ?? 0;
    },
  },

  /** Configuração de SLA por região — override do config cliente-wide. */
  slaConfigRegiao: {
    listByCliente: async (clienteId: string): Promise<SlaConfigRegiao[]> => {
      const { data, error } = await supabase
        .from('sla_config_regiao')
        .select('*, regiao:regioes(id, regiao)')
        .eq('cliente_id', clienteId)
        .order('created_at');
      if (error) throw error;
      return data as SlaConfigRegiao[];
    },

    upsert: async (clienteId: string, regiaoId: string, config: Record<string, unknown>): Promise<SlaConfigRegiao> => {
      const { data, error } = await supabase
        .from('sla_config_regiao')
        .upsert({ cliente_id: clienteId, regiao_id: regiaoId, config }, { onConflict: 'cliente_id,regiao_id' })
        .select()
        .single();
      if (error) throw error;
      return data as SlaConfigRegiao;
    },

    remove: async (id: string): Promise<void> => {
      const { error } = await supabase.from('sla_config_regiao').delete().eq('id', id);
      if (error) throw error;
    },
  },

  /** Quotas de uso por cliente. */
  quotas: {
    /** Lê limites configurados para o cliente. */
    byCliente: async (clienteId: string): Promise<ClienteQuota | null> => {
      const { data, error } = await supabase
        .from('cliente_quotas')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as ClienteQuota | null;
    },

    /** Uso corrente do mês para o cliente (RPC segura — Fix S-01). */
    usoMensal: async (_clienteId: string): Promise<ClienteUsoMensal | null> => {
      // Parâmetro clienteId mantido para compatibilidade de assinatura,
      // mas a RPC filtra internamente pelo usuário autenticado.
      const { data, error } = await supabase.rpc('fn_meu_uso_mensal');
      if (error) throw error;
      return (data as ClienteUsoMensal[])?.[0] ?? null;
    },

    /** Lista uso de todos os clientes — requer papel admin (Fix S-01). */
    usoMensalAll: async (): Promise<ClienteUsoMensal[]> => {
      // Requer papel admin — a RPC rejeita outros papéis com RAISE EXCEPTION
      const { data, error } = await supabase.rpc('fn_uso_mensal_todos_clientes');
      if (error) throw error;
      return (data as ClienteUsoMensal[]) ?? [];
    },

    /** Verificação pontual: { ok, usado, limite } para a métrica informada. */
    verificar: async (clienteId: string, metrica: 'voos_mes' | 'levantamentos_mes' | 'itens_mes' | 'usuarios_ativos' | 'vistorias_mes' | 'ia_calls_mes' | 'storage_gb'): Promise<QuotaVerificacao> => {
      const { data, error } = await supabase.rpc('cliente_verificar_quota', {
        p_cliente_id: clienteId,
        p_metrica: metrica,
      });
      if (error) throw error;
      return data as QuotaVerificacao;
    },

    /** Atualiza limites do cliente (apenas admin plataforma). */
    update: async (clienteId: string, limites: Partial<Pick<ClienteQuota, 'voos_mes' | 'levantamentos_mes' | 'itens_mes' | 'usuarios_ativos' | 'vistorias_mes' | 'ia_calls_mes' | 'storage_gb'>>): Promise<ClienteQuota> => {
      const { data, error } = await supabase
        .from('cliente_quotas')
        .update(limites)
        .eq('cliente_id', clienteId)
        .select()
        .single();
      if (error) throw error;
      return data as ClienteQuota;
    },
  },

  /** Assinaturas Web Push por usuário. */
  pushSubscriptions: {
    /** Salva (upsert) a assinatura push do usuário atual. */
    upsert: async (data: Pick<PushSubscription, 'usuario_id' | 'cliente_id' | 'endpoint' | 'p256dh' | 'auth'>): Promise<void> => {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(data, { onConflict: 'usuario_id,endpoint' });
      if (error) throw error;
    },

    /** Lista todas as assinaturas de um cliente — usada pela Edge Function. */
    listByCliente: async (clienteId: string): Promise<PushSubscription[]> => {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('cliente_id', clienteId);
      if (error) throw error;
      return (data || []) as PushSubscription[];
    },

    /** Remove a assinatura pelo endpoint (logout / revogação). */
    removeByEndpoint: async (endpoint: string): Promise<void> => {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
      if (error) throw error;
    },
  },

  /** Avaliação de condições meteorológicas para voo de drone (baseado em pluvio_risco). */
  condicoesVoo: {
    /** Avalia condições para hoje (ou data fornecida) para o cliente. */
    avaliarByCliente: async (clienteId: string, data?: string): Promise<CondicaoVoo> => {
      const params: Record<string, unknown> = { p_cliente_id: clienteId };
      if (data) params.p_data = data;
      const { data: result, error } = await supabase.rpc('avaliar_condicoes_voo', params);
      if (error) throw error;
      const r = result as CondicaoVoo & { motivos?: unknown };
      // RPC returns motivos as a JSON array — ensure it's a plain string[]
      return {
        ...r,
        motivos: Array.isArray(r.motivos) ? (r.motivos as string[]) : [],
      };
    },
  },

  yoloFeedback: {
    /** Grava (ou atualiza) feedback de um operador sobre um item de detecção YOLO. */
    upsert: async (payload: {
      levantamento_item_id: string;
      cliente_id: string;
      confirmado: boolean;
      observacao?: string;
      registrado_por?: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from('yolo_feedback')
        .upsert(payload, { onConflict: 'levantamento_item_id' });
      if (error) throw error;
    },

    /** Retorna o feedback existente para um item específico (pode ser undefined). */
    getByItem: async (levantamentoItemId: string, clienteId: string): Promise<YoloFeedback | null> => {
      const { data, error } = await supabase
        .from('yolo_feedback')
        .select('*')
        .eq('levantamento_item_id', levantamentoItemId)
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  },

  analiseIa: {
    /** Retorna a análise IA do levantamento (se já gerada). */
    getByLevantamento: async (levantamentoId: string): Promise<LevantamentoAnaliseIa | null> => {
      const { data, error } = await supabase
        .from('levantamento_analise_ia')
        .select('*')
        .eq('levantamento_id', levantamentoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    /**
     * Enfileira a triagem IA para execução assíncrona (QW-13).
     * Retorna o job_id para acompanhamento via api.jobQueue.get ou AdminJobQueue.
     */
    triggerTriagem: async (levantamentoId: string, clienteId: string): Promise<{ job_id: string }> => {
      const { data, error } = await supabase.rpc('fn_enqueue_job', {
        p_tipo: 'triagem_ia',
        p_payload: { levantamento_id: levantamentoId, cliente_id: clienteId },
      });
      if (error) throw error;
      return { job_id: data as string };
    },
  },

  casosNotificados: {
    list: async (clienteId: string): Promise<CasoNotificado[]> => {
      const { data, error } = await supabase
        .from('casos_notificados')
        .select('*, unidade_saude:unidades_saude(id,nome,tipo), notificador:usuarios(id,nome,email)')
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CasoNotificado[];
    },

    /** QW-17C: cursor pagination via RPC fn_casos_notificados_page.
     *  Retorna { data, nextCursor } — nextCursor=null indica última página.
     *  Usar com useInfiniteQuery em AdminCasosNotificados. */
    listPaginado: async (
      clienteId: string,
      opts: { limit?: number; cursorCreated?: string; cursorId?: string } = {},
    ): Promise<{ data: CasoNotificado[]; nextCursor: { created_at: string; id: string } | null }> => {
      const limit = opts.limit ?? 100;
      const { data, error } = await supabase.rpc('fn_casos_notificados_page', {
        p_cliente_id:     clienteId,
        p_limit:          limit,
        p_cursor_created: opts.cursorCreated ?? null,
        p_cursor_id:      opts.cursorId ?? null,
      });
      if (error) throw error;
      const rows = (data || []) as CasoNotificado[];
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page[page.length - 1];
      return {
        data: page,
        nextCursor: hasMore ? { created_at: last.created_at, id: last.id } : null,
      };
    },

    create: async (payload: Omit<CasoNotificado, 'id' | 'created_at' | 'updated_at'>): Promise<CasoNotificado> => {
      const { data, error } = await supabase
        .from('casos_notificados')
        .insert(payload)
        .select('*, unidade_saude:unidades_saude(id,nome,tipo)')
        .single();
      if (error) throw error;
      return data as unknown as CasoNotificado;
    },

    updateStatus: async (id: string, status: StatusCaso): Promise<void> => {
      const { error } = await supabase
        .from('casos_notificados')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },

    update: async (id: string, payload: Partial<CasoNotificado>): Promise<void> => {
      const { error } = await supabase
        .from('casos_notificados')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },

    /** Conta cruzamentos ativo para um levantamento_item via RPC. */
    countProximoAoItem: async (itemId: string): Promise<number> => {
      const { data, error } = await supabase
        .rpc('contar_casos_proximos_ao_item', { p_item_id: itemId });
      if (error) throw error;
      return (data as number) ?? 0;
    },

    /** Lista casos num raio em torno de um ponto via RPC listar_casos_no_raio. */
    listProximosAoPonto: async (
      lat: number,
      lng: number,
      clienteId: string,
      raioMetros = 300,
    ): Promise<CasoNotificado[]> => {
      const { data, error } = await supabase.rpc('listar_casos_no_raio', {
        p_lat: lat,
        p_lng: lng,
        p_raio: raioMetros,
        p_cliente: clienteId,
      });
      if (error) throw error;
      return (data || []) as CasoNotificado[];
    },

    /** Retorna os cruzamentos (com distância) de um item específico. */
    cruzamentosDoItem: async (itemId: string) => {
      const { data, error } = await supabase
        .from('caso_foco_cruzamento')
        .select('*, caso:casos_notificados(id,doenca,status,bairro,data_notificacao)')
        .eq('levantamento_item_id', itemId)
        .order('distancia_metros', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    /** Retorna cruzamentos de um caso — usado na tela de sucesso do notificador. */
    cruzamentosDoCaso: async (casoId: string) => {
      const { data, error } = await supabase
        .from('caso_foco_cruzamento')
        .select('id, distancia_metros, levantamento_item_id')
        .eq('caso_id', casoId)
        .order('distancia_metros', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    /** Conta cruzamentos criados hoje (RLS garante isolamento por cliente). */
    countCruzadosHoje: async (): Promise<number> => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from('caso_foco_cruzamento')
        .select('id', { count: 'exact', head: true })
        .gte('criado_em', hoje.toISOString());
      if (error) throw error;
      return count ?? 0;
    },

    /**
     * Retorna todos os cruzamentos do cliente (via join casos_notificados).
     * Usado para construir o Set<levantamento_item_id> exibido no mapa e na lista de focos.
     * RLS garante isolamento — não vaza entre clientes.
     */
    /** Retorna Set de caso_ids que têm cruzamento com foco — para destacar no mapa. */
    listCasoIdsComCruzamento: async (casoIds: string[]): Promise<string[]> => {
      if (!casoIds.length) return [];
      const { data, error } = await supabase
        .from('caso_foco_cruzamento')
        .select('caso_id')
        .in('caso_id', casoIds);
      if (error) throw error;
      return [...new Set((data || []).map((r: { caso_id: string }) => r.caso_id))];
    },

    listCruzamentos: async (clienteId: string): Promise<{ levantamento_item_id: string; distancia_metros: number; criado_em: string }[]> => {
      const { data, error } = await supabase
        .from('caso_foco_cruzamento')
        .select('levantamento_item_id, distancia_metros, criado_em, casos_notificados!inner(cliente_id)')
        .eq('casos_notificados.cliente_id', clienteId)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: { levantamento_item_id: string; distancia_metros: number; criado_em: string }) => ({
        levantamento_item_id: r.levantamento_item_id,
        distancia_metros: r.distancia_metros,
        criado_em: r.criado_em,
      }));
    },
  },

  unidadesSaude: {
    list: async (clienteId: string): Promise<UnidadeSaude[]> => {
      const { data, error } = await supabase
        .from('unidades_saude')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('nome');
      if (error) throw error;
      return data || [];
    },

    create: async (payload: Omit<UnidadeSaude, 'id' | 'created_at' | 'updated_at'>): Promise<UnidadeSaude> => {
      const { data, error } = await supabase
        .from('unidades_saude')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as UnidadeSaude;
    },

    update: async (id: string, payload: Partial<UnidadeSaude>): Promise<void> => {
      const { error } = await supabase
        .from('unidades_saude')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
  },

  imoveis: {
    list: async (clienteId: string, regiaoId?: string): Promise<Imovel[]> => {
      let q = supabase
        .from('imoveis')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .order('logradouro');
      if (regiaoId) q = q.eq('regiao_id', regiaoId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    listResumo: async (clienteId: string, regiaoId?: string): Promise<ImovelResumo[]> => {
      let q = supabase
        .from('v_imovel_resumo')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('score_territorial', { ascending: false, nullsFirst: false });
      if (regiaoId) q = q.eq('regiao_id', regiaoId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    getResumoById: async (id: string): Promise<ImovelResumo | null> => {
      const { data, error } = await supabase
        .from('v_imovel_resumo')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    findByEndereco: async (
      clienteId: string,
      logradouro: string,
      numero: string,
    ): Promise<Imovel | null> => {
      const { data, error } = await supabase
        .from('imoveis')
        .select('*')
        .eq('cliente_id', clienteId)
        .ilike('logradouro', logradouro.trim())
        .eq('numero', numero.trim())
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Imovel | null;
    },

    create: async (payload: Omit<Imovel, 'id' | 'created_at' | 'updated_at'>): Promise<Imovel> => {
      const { data, error } = await supabase
        .from('imoveis')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Imovel;
    },

    update: async (id: string, payload: Partial<Imovel>): Promise<void> => {
      const { error } = await supabase
        .from('imoveis')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },

    listProblematicos: async (clienteId: string): Promise<ImovelHistoricoAcesso[]> => {
      const { data, error } = await supabase
        .from('v_imovel_historico_acesso')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('pct_sem_acesso', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ImovelHistoricoAcesso[];
    },

    marcarPrioridadeDrone: async (imovelId: string, valor: boolean): Promise<void> => {
      const { error } = await supabase
        .from('imoveis')
        .update({ prioridade_drone: valor })
        .eq('id', imovelId);
      if (error) throw error;
    },

    atualizarPerfil: async (
      imovelId: string,
      payload: Pick<Imovel, 'proprietario_ausente' | 'tipo_ausencia' | 'contato_proprietario' | 'tem_animal_agressivo' | 'tem_calha' | 'calha_acessivel'>,
    ): Promise<void> => {
      const { error } = await supabase
        .from('imoveis')
        .update(payload)
        .eq('id', imovelId);
      if (error) throw error;
    },

    countPrioridadeDroneByCliente: async (clienteId: string): Promise<number> => {
      const { count, error } = await supabase
        .from('imoveis')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)
        .eq('prioridade_drone', true);
      if (error) throw error;
      return count ?? 0;
    },

    /**
     * Importação em lote via CSV.
     * Processa em batches de BATCH_SIZE para não exceder limites do Supabase.
     * onProgress é chamado após cada batch com o total acumulado de importados.
     */
    /**
     * Retorna um Set de chaves "logradouro|numero|bairro" (lowercase) já cadastradas
     * para o cliente. Usado para deduplicação antes de batchCreate.
     */
    buscarChavesExistentes: async (clienteId: string): Promise<Set<string>> => {
      const { data } = await supabase
        .from('imoveis')
        .select('logradouro, numero, bairro')
        .eq('cliente_id', clienteId)
        .eq('ativo', true);
      const keys = new Set<string>();
      for (const r of data ?? []) {
        keys.add(
          `${(r.logradouro ?? '').toLowerCase().trim()}|${(r.numero ?? '').toLowerCase().trim()}|${(r.bairro ?? '').toLowerCase().trim()}`,
        );
      }
      return keys;
    },

    batchCreate: async (
      clienteId: string,
      registros: Omit<Imovel, 'id' | 'created_at' | 'updated_at'>[],
      onProgress?: (importados: number, total: number) => void,
    ): Promise<{ importados: number; falhas: number }> => {
      const BATCH_SIZE = 500;
      let importados = 0;
      let falhas = 0;
      const total = registros.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = registros.slice(i, i + BATCH_SIZE).map(r => ({
          ...r,
          cliente_id: clienteId,
          ativo: true,
        }));
        const { error } = await supabase.from('imoveis').insert(chunk);
        if (error) {
          falhas += chunk.length;
        } else {
          importados += chunk.length;
        }
        onProgress?.(importados, total);
      }
      return { importados, falhas };
    },
  },

  importLog: {
    criar: async (payload: {
      clienteId: string;
      criadoPor?: string;
      filename: string;
      totalLinhas: number;
    }): Promise<string> => {
      const { data, error } = await supabase
        .from('import_log')
        .insert({
          cliente_id:   payload.clienteId,
          criado_por:   payload.criadoPor ?? null,
          filename:     payload.filename,
          total_linhas: payload.totalLinhas,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },

    finalizar: async (
      id: string,
      resultado: {
        importados: number;
        comErro: number;
        ignorados: number;
        erros: unknown[];
        status: 'concluido' | 'falhou';
        duplicados?: number;
        geocodificados?: number;
        geoFalhou?: number;
      },
    ): Promise<void> => {
      const { error } = await supabase
        .from('import_log')
        .update({
          importados:     resultado.importados,
          com_erro:       resultado.comErro,
          ignorados:      resultado.ignorados,
          erros:          resultado.erros,
          status:         resultado.status,
          duplicados:     resultado.duplicados ?? 0,
          geocodificados: resultado.geocodificados ?? 0,
          geo_falhou:     resultado.geoFalhou ?? 0,
          finished_at:    new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },

    listarByCliente: async (clienteId: string, limit = 10): Promise<{
      id: string; filename: string; importados: number; com_erro: number;
      total_linhas: number; status: string; created_at: string;
    }[]> => {
      const { data, error } = await supabase
        .from('import_log')
        .select('id, filename, importados, com_erro, total_linhas, status, created_at')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
  },

  vistorias: {
    listByAgente: async (clienteId: string, agenteId: string, ciclo?: number): Promise<Vistoria[]> => {
      let q = supabase
        .from('vistorias')
        .select('*, imovel:imoveis(*), agente:usuarios(id,nome)')
        .eq('cliente_id', clienteId)
        .eq('agente_id', agenteId)
        .order('data_visita', { ascending: false });
      if (ciclo) q = q.eq('ciclo', ciclo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Vistoria[];
    },

    listByImovel: async (imovelId: string, clienteId: string): Promise<Vistoria[]> => {
      const { data, error } = await supabase
        .from('vistorias')
        .select('*, agente:usuarios(id,nome)')
        .eq('imovel_id', imovelId)
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('data_visita', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Vistoria[];
    },

    create: async (payload: Omit<Vistoria, 'id' | 'created_at' | 'updated_at'>): Promise<Vistoria> => {
      const { data, error } = await supabase
        .from('vistorias')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Vistoria;
    },

    updateStatus: async (id: string, status: StatusVistoria): Promise<void> => {
      const { error } = await supabase
        .from('vistorias')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },

    addDeposito: async (
      vistoriaId: string,
      deposito: Omit<VistoriaDeposito, 'id' | 'created_at'>,
    ): Promise<void> => {
      const { error } = await supabase
        .from('vistoria_depositos')
        .upsert({ ...deposito, vistoria_id: vistoriaId }, { onConflict: 'vistoria_id,tipo' });
      if (error) throw error;
    },

    addSintomas: async (
      sintomas: Omit<VistoriaSintomas, 'id' | 'created_at' | 'gerou_caso_notificado_id'>,
    ): Promise<VistoriaSintomas> => {
      const { data, error } = await supabase
        .from('vistoria_sintomas')
        .insert(sintomas)
        .select()
        .single();
      if (error) throw error;
      return data as VistoriaSintomas;
    },

    addRiscos: async (riscos: Omit<VistoriaRiscos, 'id' | 'created_at'>): Promise<void> => {
      const { error } = await supabase
        .from('vistoria_riscos')
        .insert(riscos);
      if (error) throw error;
    },

    getResumoAgente: async (
      clienteId: string,
      agenteId: string,
      ciclo: number,
    ): Promise<VistoriaResumo> => {
      const { data, error } = await supabase.rpc('resumo_agente_ciclo', {
        p_cliente_id: clienteId,
        p_agente_id: agenteId,
        p_ciclo: ciclo,
      });
      if (error) throw error;
      return data as VistoriaResumo;
    },

    registrarSemAcesso: async (
      vistoriaId: string,
      payload: {
        motivo_sem_acesso: MotivoSemAcesso;
        proximo_horario_sugerido?: HorarioSugerido;
        observacao_acesso?: string;
        foto_externa_url?: string;
      },
    ): Promise<void> => {
      const { error } = await supabase
        .from('vistorias')
        .update({
          acesso_realizado: false,
          status: 'revisita' as StatusVistoria,
          ...payload,
        })
        .eq('id', vistoriaId);
      if (error) throw error;
    },

    addCalha: async (
      vistoriaId: string,
      calha: Omit<VistoriaCalha, 'id' | 'created_at'>,
    ): Promise<void> => {
      const { error } = await supabase
        .from('vistoria_calhas')
        .insert({ ...calha, vistoria_id: vistoriaId });
      if (error) throw error;
    },

    listCalhas: async (vistoriaId: string): Promise<VistoriaCalha[]> => {
      const { data, error } = await supabase
        .from('vistoria_calhas')
        .select('*')
        .eq('vistoria_id', vistoriaId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as VistoriaCalha[];
    },

    /** F-01: Persiste vistoria completa em uma única transação via RPC. */
    createCompleta: async (payload: Record<string, unknown>): Promise<string> => {
      const { data, error } = await supabase.rpc('create_vistoria_completa', {
        p_payload: payload,
      });
      if (error) logAndThrow(error, 'vistorias.createCompleta', { clienteId: payload.cliente_id, agenteId: payload.agente_id });
      return data as string; // uuid da vistoria criada
    },

    /** QW-10B: persiste public_ids do Cloudinary após createCompleta. */
    atualizarPublicIds: async (
      vistoriaId: string,
      ids: { assinatura_public_id?: string | null; foto_externa_public_id?: string | null },
    ): Promise<void> => {
      const payload: Record<string, string | null> = {};
      if (ids.assinatura_public_id   !== undefined) payload.assinatura_public_id   = ids.assinatura_public_id;
      if (ids.foto_externa_public_id !== undefined) payload.foto_externa_public_id = ids.foto_externa_public_id;
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase.from('vistorias').update(payload).eq('id', vistoriaId);
      if (error) throw error;
    },

    /** QW-05: marca pendências de evidências perdidas no modo offline. */
    marcarPendencias: async (
      vistoriaId: string,
      pendencias: { pendente_assinatura?: boolean; pendente_foto?: boolean },
    ): Promise<void> => {
      const { error } = await supabase
        .from('vistorias')
        .update(pendencias)
        .eq('id', vistoriaId);
      if (error) throw error;
    },

    comparativoAgentes: async (clienteId: string, ciclo: number) => {
      const { data, error } = await supabase.rpc('rpc_comparativo_agentes', {
        p_cliente_id: clienteId,
        p_ciclo: ciclo,
      });
      if (error) throw error;
      return (data || []);
    },

    /** Lista vistorias com dados de consolidação — para listas operacionais do gestor/supervisor. */
    listConsolidadas: async (
      clienteId: string,
      opts?: {
        prioridade?: Array<'P1' | 'P2' | 'P3' | 'P4' | 'P5'>;
        alerta_saude?: 'nenhum' | 'atencao' | 'urgente' | 'inconclusivo';
        risco_vetorial?: 'baixo' | 'medio' | 'alto' | 'critico' | 'inconclusivo';
        consolidacao_incompleta?: boolean;
        limit?: number;
      },
    ): Promise<Vistoria[]> => {
      let q = supabase
        .from('vistorias')
        .select(`
          id, data_visita, status, acesso_realizado,
          prioridade_final, prioridade_motivo, dimensao_dominante,
          vulnerabilidade_domiciliar, alerta_saude, risco_socioambiental, risco_vetorial,
          consolidacao_incompleta, consolidacao_resumo, consolidado_em,
          imovel:imoveis(id, logradouro, numero, bairro, regiao_id),
          agente:usuarios(id, nome)
        `)
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .not('prioridade_final', 'is', null)
        .order('consolidado_em', { ascending: false })
        .limit(opts?.limit ?? 50);

      if (opts?.prioridade?.length) q = q.in('prioridade_final', opts.prioridade);
      if (opts?.alerta_saude)        q = q.eq('alerta_saude', opts.alerta_saude);
      if (opts?.risco_vetorial)      q = q.eq('risco_vetorial', opts.risco_vetorial);
      if (opts?.consolidacao_incompleta === true) q = q.eq('consolidacao_incompleta', true);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Vistoria[];
    },
  },

  /** Métodos exclusivos para admin da plataforma — cruzam dados entre todos os clientes. */
  admin: {
    /** Agrega métricas dos últimos 7 dias por município (cliente ativo). */
    comparativoMunicipios: async (): Promise<MunicipioStats[]> => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('focos_risco')
        .select(`
          id, status, prioridade, suspeita_em,
          cliente:clientes!inner(id, nome, ativo)
        `)
        .eq('cliente.ativo', true)
        .gte('suspeita_em', sevenDaysAgo);
      if (error) throw error;
      // Agregar por cliente
      const byCliente = new Map<string, MunicipioStats>();
      for (const item of data || []) {
        const cli = item.cliente as unknown as { id: string; nome: string };
        const id = cli.id;
        if (!byCliente.has(id)) {
          byCliente.set(id, {
            clienteId: id,
            nome: cli.nome,
            total: 0,
            resolvidos: 0,
            pendentes: 0,
            em_atendimento: 0,
            criticos: 0,
            altos: 0,
          });
        }
        const s = byCliente.get(id)!;
        s.total++;
        const st = String(item.status || '').toLowerCase();
        const op = mapFocoToStatusOperacional(st as FocoStatus);
        if (op === 'resolvido') s.resolvidos++;
        else if (op === 'em_atendimento') s.em_atendimento++;
        else s.pendentes++;

        const p = String(item.prioridade || '').toUpperCase();
        if (p === 'P1') s.criticos++;
        else if (p === 'P2') s.altos++;
      }
      return Array.from(byCliente.values());
    },
  },

  /** Cadastro de drones. */
  drones: {
    list: async (clienteId: string): Promise<Drone[]> => {
      const { data, error } = await supabase
        .from('drones')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('marca')
        .order('modelo');
      if (error) throw error;
      return (data || []) as Drone[];
    },
    create: async (payload: Omit<Drone, 'id' | 'created_at' | 'updated_at'>): Promise<Drone> => {
      const { data, error } = await supabase
        .from('drones')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Drone;
    },
    update: async (id: string, payload: Partial<Drone>): Promise<void> => {
      const { error } = await supabase
        .from('drones')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    remove: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('drones')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  },

  /** Voos de drone filtrados por cliente. */
  voos: {
    listByCliente: async (clienteId: string): Promise<Voo[]> => {
      const { data, error } = await supabase
        .from('voos')
        .select('*, planejamento:planejamento(id, descricao, cliente_id), piloto:usuarios(id, nome)')
        .eq('planejamento.cliente_id', clienteId)
        .order('inicio', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Voo[];
    },
    create: async (payload: Omit<Voo, 'id' | 'created_at' | 'updated_at'>): Promise<Voo> => {
      const { data, error } = await supabase
        .from('voos')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Voo;
    },
    update: async (id: string, payload: Partial<Voo>): Promise<void> => {
      const { error } = await supabase
        .from('voos')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    remove: async (id: string): Promise<void> => {
      const { error } = await supabase.from('voos').delete().eq('id', id);
      if (error) throw error;
    },
    bulkCreate: async (rows: Partial<Voo>[]): Promise<void> => {
      const CHUNK = 50;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('voos').insert(rows.slice(i, i + CHUNK));
        if (error) throw error;
      }
    },
  },

  /** Configurações de integração por cliente (e-SUS Notifica, RNDS). */
  integracoes: {
    getByCliente: async (clienteId: string, tipo: 'esus_notifica' | 'rnds' = 'esus_notifica'): Promise<ClienteIntegracao | null> => {
      // api_key excluída intencionalmente — usar revelarChave() quando necessário
      const { data, error } = await supabase
        .from('cliente_integracoes')
        .select('id, cliente_id, tipo, api_key_masked, endpoint_url, codigo_ibge, unidade_saude_cnes, ambiente, ativo, ultima_sincronizacao, created_at, updated_at')
        .eq('cliente_id', clienteId)
        .eq('tipo', tipo)
        .maybeSingle();
      if (error) throw error;
      return data as ClienteIntegracao | null;
    },

    upsert: async (payload: Omit<ClienteIntegracao, 'id' | 'created_at' | 'updated_at' | 'ultima_sincronizacao' | 'api_key_masked'> & { api_key: string }): Promise<ClienteIntegracao> => {
      const { data, error } = await supabase
        .from('cliente_integracoes')
        .upsert(payload, { onConflict: 'cliente_id,tipo' })
        .select('id, cliente_id, tipo, api_key_masked, endpoint_url, codigo_ibge, unidade_saude_cnes, ambiente, ativo, ultima_sincronizacao, created_at, updated_at')
        .single();
      if (error) throw error;
      return data as ClienteIntegracao;
    },

    /** Atualiza metadados da integração sem alterar api_key existente. */
    updateMeta: async (id: string, payload: Partial<Omit<ClienteIntegracao, 'id' | 'api_key' | 'api_key_masked' | 'created_at' | 'updated_at'>>): Promise<ClienteIntegracao> => {
      const { data, error } = await supabase
        .from('cliente_integracoes')
        .update(payload)
        .eq('id', id)
        .select('id, cliente_id, tipo, api_key_masked, endpoint_url, codigo_ibge, unidade_saude_cnes, ambiente, ativo, ultima_sincronizacao, created_at, updated_at')
        .single();
      if (error) throw error;
      return data as ClienteIntegracao;
    },

    /** Revela a api_key completa via RPC segura (exige admin ou supervisor).
     *  A chamada registra auditoria automaticamente no banco. */
    revelarChave: async (integracaoId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('get_integracao_api_key', { p_integracao_id: integracaoId });
      if (error) throw error;
      return data as string;
    },

    testarConexao: async (clienteId: string): Promise<{ ok: boolean; mensagem: string }> => {
      const integracao = await api.integracoes.getByCliente(clienteId);
      if (!integracao || !integracao.ativo) {
        return { ok: false, mensagem: 'Integração não configurada ou inativa.' };
      }
      try {
        const apiKey = await api.integracoes.revelarChave(integracao.id);
        const response = await fetch(`${integracao.endpoint_url}/health`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) return { ok: true, mensagem: 'Conexão estabelecida com sucesso.' };
        return { ok: false, mensagem: `HTTP ${response.status}: ${response.statusText}` };
      } catch (err) {
        return { ok: false, mensagem: `Erro de conexão: ${err instanceof Error ? err.message : 'Desconhecido'}` };
      }
    },
  },

  /** Auditoria de notificações enviadas ao e-SUS Notifica. */
  notificacoesESUS: {
    listByCliente: async (clienteId: string): Promise<ItemNotificacaoESUS[]> => {
      const { data, error } = await supabase
        .from('item_notificacoes_esus')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ItemNotificacaoESUS[];
    },

    listByItem: async (itemId: string, clienteId: string): Promise<ItemNotificacaoESUS[]> => {
      const { data, error } = await supabase
        .from('item_notificacoes_esus')
        .select('*')
        .eq('levantamento_item_id', itemId)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ItemNotificacaoESUS[];
    },

    enviar: async (
      clienteId: string,
      itemId: string,
      tipoAgravo: TipoAgravoESUS,
      enviadoPor: string,
      integracao: ClienteIntegracao,
      itemData: {
        endereco_completo?: string | null;
        endereco_curto?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        data_hora?: string | null;
      },
    ): Promise<ItemNotificacaoESUS> => {
      // Montar payload e-SUS Notifica via sinan.ts (algoritmo SVS oficial)
      const payload: ESUSNotificaPayload = montarPayloadESUS(
        itemData,
        integracao.codigo_ibge ?? '',
        integracao.unidade_saude_cnes ?? '',
        tipoAgravo,
      );

      // Criar registro de auditoria em estado "pendente"
      const { data: registro, error: insertError } = await supabase
        .from('item_notificacoes_esus')
        .insert({
          cliente_id:           clienteId,
          levantamento_item_id: itemId,
          tipo_agravo:          tipoAgravo,
          status:               'pendente',
          payload_enviado:      payload,
          enviado_por:          enviadoPor,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Revelar chave via RPC segura (registra auditoria automaticamente)
      const apiKey = await api.integracoes.revelarChave(integracao.id);

      // Enviar para a API e-SUS Notifica
      try {
        const response = await fetch(integracao.endpoint_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Ambiente': integracao.ambiente,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        const respBody = await response.json().catch(() => ({})) as { id?: string; numero?: string; message?: string; error?: string };

        if (response.ok) {
          const { error: upd } = await supabase
            .from('item_notificacoes_esus')
            .update({
              status:             'enviado',
              numero_notificacao: respBody?.id ?? respBody?.numero ?? null,
              resposta_api:       respBody,
              updated_at:         new Date().toISOString(),
            })
            .eq('id', (registro as ItemNotificacaoESUS).id);
          if (upd) throw upd;
          return { ...(registro as ItemNotificacaoESUS), status: 'enviado', numero_notificacao: respBody?.id ?? null };
        } else {
          const errMsg = respBody?.message ?? respBody?.error ?? `HTTP ${response.status}`;
          await supabase
            .from('item_notificacoes_esus')
            .update({ status: 'erro', erro_mensagem: errMsg, resposta_api: respBody, updated_at: new Date().toISOString() })
            .eq('id', (registro as ItemNotificacaoESUS).id);
          throw new Error(errMsg);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        await supabase
          .from('item_notificacoes_esus')
          .update({ status: 'erro', erro_mensagem: errMsg, updated_at: new Date().toISOString() })
          .eq('id', (registro as ItemNotificacaoESUS).id);
        throw err;
      }
    },

    descartar: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('item_notificacoes_esus')
        .update({ status: 'descartado', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    /** G-03: Retenta uma notificação com status='erro'. Reutiliza o payload original. */
    reenviar: async (
      id: string,
      integracao: ClienteIntegracao,
    ): Promise<void> => {
      const { data: notif, error: fetchErr } = await supabase
        .from('item_notificacoes_esus')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const registro = notif as ItemNotificacaoESUS;
      const payload = registro.payload_enviado as ESUSNotificaPayload;

      // Recalcular semana epidemiológica com o algoritmo correto antes de reenviar
      const dtNotific = payload.dataNotificacao ?? new Date().toISOString().slice(0, 10);
      payload.semanaEpidemiologica = calcularSemanaEpidemiologica(dtNotific);

      await supabase
        .from('item_notificacoes_esus')
        .update({ status: 'pendente', erro_mensagem: null, updated_at: new Date().toISOString() })
        .eq('id', id);

      try {
        const response = await fetch(integracao.endpoint_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${integracao.api_key}`,
            'X-Ambiente': integracao.ambiente,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        const respBody = await response.json().catch(() => ({})) as { id?: string; numero?: string; message?: string; error?: string };
        if (response.ok) {
          await supabase
            .from('item_notificacoes_esus')
            .update({
              status: 'enviado',
              numero_notificacao: respBody?.id ?? respBody?.numero ?? null,
              resposta_api: respBody,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        } else {
          const errMsg = respBody?.message ?? respBody?.error ?? `HTTP ${response.status}`;
          await supabase
            .from('item_notificacoes_esus')
            .update({ status: 'erro', erro_mensagem: errMsg, resposta_api: respBody, updated_at: new Date().toISOString() })
            .eq('id', id);
          throw new Error(errMsg);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        await supabase
          .from('item_notificacoes_esus')
          .update({ status: 'erro', erro_mensagem: errMsg, updated_at: new Date().toISOString() })
          .eq('id', id);
        throw err;
      }
    },
  },

  /** Sincronização CNES/DATASUS de unidades_saude. */
  cnesSync: {
    /** Dispara sincronização manual via Edge Function para o cliente logado. */
    sincronizarManual: async (clienteId: string, usuarioId?: string): Promise<{ controle_id: string; status: string; message: string }> => {
      try {
        // Chamada via fetch (anon/apikey) para evitar que o Supabase client
        // tente usar o JWT da sessão do usuário e cause "Invalid JWT" + redirect.
        const endpoint = `${supabaseUrl}/functions/v1/cnes-sync`;
        const payload = {
          origem: 'manual',
          cliente_id: clienteId,
          ...(usuarioId ? { usuario_id: usuarioId } : {}),
        };

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            // Usar anon key como Bearer — a Edge Function usa service_role internamente
            // e não precisa do JWT do usuário. O JWT da sessão causa "Invalid JWT" no gateway.
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify(payload),
        });

        const respBody = await resp.json().catch(() => ({})) as { error?: string; message?: string; detail?: string; controle_id?: string; status?: string };
        if (!resp.ok) {
          const msg = respBody?.error ?? respBody?.message ?? respBody?.detail ?? resp.statusText ?? `HTTP ${resp.status}`;
          throw new Error(String(msg));
        }

        // Auditoria: registra força de sync CNES
        supabase.rpc('registrar_audit', {
          p_acao: 'force_sync_cnes',
          p_tabela: 'unidades_saude_sync_controle',
          p_registro_id: respBody?.controle_id ?? null,
          p_descricao: `Sync CNES manual iniciado`,
          p_payload: { cliente_id: clienteId, status: respBody?.status },
        }).catch(() => { /* audit fail-safe */ });

        return respBody;
      } catch (err) {
        const errAny = err as { message?: string };
        // Supabase pode jogar um erro que não é instance of Error (ex.: SupabaseFetchError / SupabaseError).
        // Por isso, tentamos extrair `.message` mesmo sem `instanceof`.
        const message =
          (errAny && typeof errAny.message === 'string'
            ? errAny.message
            : err instanceof Error
              ? err.message
              : String(err)) || '';
        const context = (err as { context?: { status?: number; json?: () => Promise<unknown>; text?: () => Promise<string> } })?.context;
        const status = context?.status;

        let remoteMessage = '';
        if (context?.json) {
          try {
            const parsed = await context.json();
            if (parsed && typeof parsed === 'object') {
              const p = parsed as Record<string, unknown>;
              remoteMessage =
                String(p.error ?? p.message ?? p.detail ?? '').trim() ||
                (Object.keys(p).length ? JSON.stringify(p) : '');
            }
          } catch {
            // ignore json parse failure
          }
        }

        if (!remoteMessage && context?.text) {
          try {
            const text = await context.text();
            remoteMessage = text || '';
          } catch {
            // ignore body read failure
          }
        }

        // Se não foi possível extrair body, pelo menos informe o status HTTP.
        if (!remoteMessage && status) {
          remoteMessage = `HTTP ${status}`;
        }

        const combined = `${message} ${remoteMessage}`.toLowerCase();
        if (/invalid\s*jwt/i.test(combined) || /invalid_jwt/i.test(combined)) {
          // Mantém erro legível caso ainda apareça.
          throw new Error(message || remoteMessage || 'invalid JWT');
        }

        if (status === 404 || /404/.test(message)) {
          throw new Error('A Edge Function "cnes-sync" nao esta publicada no projeto Supabase (HTTP 404). Faca o deploy da funcao e tente novamente.');
        }

        if (status === 422 && remoteMessage) {
          throw new Error(remoteMessage);
        }

        if ((status === 400 || status === 401 || status === 403 || status === 500) && remoteMessage) {
          throw new Error(remoteMessage);
        }

        if (/Failed to send a request to the Edge Function/i.test(message)) {
          throw new Error('Nao foi possivel conectar na Edge Function "cnes-sync". Verifique conectividade, URL do projeto e se a funcao esta deployada.');
        }

        // Evita mensagem genérica do Supabase quando o body não foi extraído.
        if (status && !remoteMessage) {
          throw new Error(`Edge Function "cnes-sync" retornou HTTP ${status}. Verifique os logs da funcao.`);
        }

        throw err;
      }
    },

    /** Busca histórico das últimas execuções para o cliente. */
    listarControle: async (clienteId: string, limit = 10): Promise<UnidadesSaudeSyncControle[]> => {
      const { data, error } = await supabase
        .from('unidades_saude_sync_controle')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('iniciado_em', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as UnidadesSaudeSyncControle[];
    },

    /** Busca log detalhado de uma execução específica. */
    listarLog: async (controleId: string, limit = 100): Promise<UnidadesSaudeSyncLog[]> => {
      const { data, error } = await supabase
        .from('unidades_saude_sync_log')
        .select('*')
        .eq('controle_id', controleId)
        .order('created_at')
        .limit(limit);
      if (error) throw error;
      return (data || []) as UnidadesSaudeSyncLog[];
    },

    /** Verifica se há execução em andamento para o cliente. */
    emAndamento: async (clienteId: string): Promise<boolean> => {
      const { data, error } = await supabase
        .from('unidades_saude_sync_controle')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('status', 'em_andamento')
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  },

  /** Usuários da plataforma. */
  usuarios: {
    listByCliente: async (clienteId: string): Promise<UsuarioComPapel[]> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, cliente:clientes(nome)')
        .eq('cliente_id', clienteId)
        .order('nome');
      if (error) throw error;
      return (data || []) as unknown as UsuarioComPapel[];
    },

    /** Retorna apenas usuários com papel 'agente' no cliente.
     *  Aceita 'operador' como legado pré-migration 20261015000000. */
    listAgentes: async (clienteId: string): Promise<UsuarioComPapel[]> => {
      const CAMP = new Set(['agente', 'operador']); // operador: legado pré-migration

      let papeisRows: { usuario_id: string; papel: string }[];
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_papeis_by_cliente', {
        p_cliente_id: clienteId,
      });
      if (!rpcErr) {
        papeisRows = (rpcData || []) as { usuario_id: string; papel: string }[];
      } else {
        const { data: uids } = await supabase
          .from('usuarios')
          .select('auth_id')
          .eq('cliente_id', clienteId);
        const ids = (uids || []).map((u: { auth_id: string }) => u.auth_id).filter(Boolean);
        if (ids.length === 0) return [];
        const { data: papeis, error: e2 } = await supabase
          .from('papeis_usuarios')
          .select('usuario_id, papel')
          .in('usuario_id', ids);
        if (e2) throw e2;
        papeisRows = (papeis || []).map((p: { usuario_id: string; papel: string }) => ({
          usuario_id: p.usuario_id,
          papel: String(p.papel ?? '').toLowerCase(),
        }));
      }

      const papelPorAuthId = new Map<string, string>();
      for (const r of papeisRows) {
        const p = String(r.papel ?? '').toLowerCase();
        if (CAMP.has(p)) papelPorAuthId.set(r.usuario_id, p);
      }
      if (papelPorAuthId.size === 0) return [];

      const { data: usu, error: errUsu } = await supabase
        .from('usuarios')
        .select('id, nome, email, cliente_id, auth_id, created_at, updated_at')
        .eq('cliente_id', clienteId)
        .order('nome');
      if (errUsu) throw errUsu;

      type UsuarioLinha = {
        id: string;
        nome: string;
        email: string;
        cliente_id: string;
        auth_id: string;
        created_at: string;
        updated_at: string;
      };
      return (usu || [])
        .filter((u: { auth_id?: string | null }): u is UsuarioLinha =>
          !!u.auth_id && papelPorAuthId.has(u.auth_id))
        .map((u) => ({
          ...u,
          papel: papelPorAuthId.get(u.auth_id) ?? 'agente',
        })) as UsuarioComPapel[];
    },
    /** Lista todos os usuários de todos os clientes — exclusivo para admin de plataforma. */
    listAll: async (): Promise<UsuarioComPapel[]> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, cliente:clientes(nome)')
        .order('nome');
      if (error) throw error;
      return (data || []) as unknown as UsuarioComPapel[];
    },
    /** Retorna todos os papéis sem filtro de cliente — exclusivo para admin de plataforma. */
    listAllPapeis: async (): Promise<{ usuario_id: string; papel: string }[]> => {
      const { data, error } = await supabase.from('papeis_usuarios').select('usuario_id, papel');
      if (error) throw error;
      return (data || []) as { usuario_id: string; papel: string }[];
    },
    listPapeis: async (clienteId: string): Promise<{ usuario_id: string; papel: string }[]> => {
      const { data, error } = await supabase.rpc('get_papeis_by_cliente', { p_cliente_id: clienteId });
      if (!error) return (data || []) as { usuario_id: string; papel: string }[];
      // Fallback seguro: filtra por auth_id de usuários do cliente (papeis_usuarios.usuario_id = auth_id)
      console.warn('get_papeis_by_cliente RPC indisponível, usando fallback filtrado:', error.message);
      const { data: uids } = await supabase
        .from('usuarios')
        .select('auth_id')
        .eq('cliente_id', clienteId);
      const ids = (uids || []).map((u: { auth_id: string }) => u.auth_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: papeis, error: e2 } = await supabase
        .from('papeis_usuarios')
        .select('usuario_id, papel')
        .in('usuario_id', ids);
      if (e2) throw e2;
      return papeis || [];
    },
    /** Verifica se já existe um usuário com o email fornecido (case-insensitive). */
    checkEmailExists: async (email: string): Promise<boolean> => {
      const { data } = await supabase
        .from('usuarios')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      return !!data;
    },
    /** Insere um novo registro de usuário. */
    insert: async (payload: { nome: string; email: string; cliente_id: string | null; auth_id?: string }): Promise<void> => {
      const { error } = await supabase.from('usuarios').insert(payload);
      if (error) throw error;
    },
    /** Atualiza campos de perfil do usuário. cliente_id é intencionalmente excluído — alteração de cliente requer operação administrativa explícita. */
    update: async (id: string, payload: { nome?: string; email?: string; agrupamento_id?: string | null; auth_id?: string }): Promise<void> => {
      const { error } = await supabase.from('usuarios').update(payload).eq('id', id);
      if (error) throw error;
    },
    /** Atribui papel ao usuário via RPC atômica (substitui DELETE+INSERT não-atômico). */
    updatePapel: async (authId: string, papel: string): Promise<void> => {
      const { error } = await supabase.rpc('rpc_set_papel_usuario', { p_auth_id: authId, p_papel: papel });
      if (error) throw error;
    },
    /** Remove todos os papéis de um auth_id e insere o novo papel informado (via RPC atômica). */
    setPapel: async (authId: string, papel: string): Promise<void> => {
      const { error } = await supabase.rpc('rpc_set_papel_usuario', { p_auth_id: authId, p_papel: papel });
      if (error) throw error;
    },
    /** Remove papéis de um auth_id (sem inserir novo). */
    deletePapeis: async (authId: string): Promise<void> => {
      const { error } = await supabase.from('papeis_usuarios').delete().eq('usuario_id', authId);
      if (error) throw error;
    },
    remove: async (id: string): Promise<void> => {
      // Soft delete — preserva FKs em foco_risco_historico, vistorias, etc.
      // Filtrar por ativo=true em listagens (já documentado no CLAUDE.md).
      const { error } = await supabase.from('usuarios').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    /** Persiste conclusão do onboarding — idempotente (upsert via update por id). */
    marcarOnboardingConcluido: async (usuarioId: string, versao: string): Promise<void> => {
      const { error } = await supabase
        .from('usuarios')
        .update({
          onboarding_concluido: true,
          onboarding_versao: versao,
          onboarding_concluido_em: new Date().toISOString(),
        })
        .eq('id', usuarioId);
      if (error) throw error;
    },
  },

  /** Políticas de risco pluviométrico. */
  riskPolicy: {
    listByCliente: async (clienteId: string): Promise<SentinelaRiskPolicy[]> => {
      const { data, error } = await supabase
        .from('sentinela_risk_policy')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('name')
        .order('version');
      if (error) throw error;
      return (data as SentinelaRiskPolicy[]) || [];
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('sentinela_risk_policy').delete().eq('id', id);
      if (error) throw error;
    },
    listAllClienteIds: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('sentinela_risk_policy').select('cliente_id');
      if (error) throw error;
      return (data || []).map(p => p.cliente_id as string);
    },
  },

  /** Configuração de risco para drone/YOLO por cliente. */
  droneRiskConfig: {
    getByCliente: async (clienteId: string): Promise<SentinelaDroneRiskConfig> => {
      const { data, error } = await supabase
        .from('sentinela_drone_risk_config')
        .select('*')
        .eq('cliente_id', clienteId)
        .single();
      if (error) throw error;
      return data as SentinelaDroneRiskConfig;
    },
    update: async (clienteId: string, payload: Partial<SentinelaDroneRiskConfig>): Promise<void> => {
      const { error } = await supabase
        .from('sentinela_drone_risk_config')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('cliente_id', clienteId);
      if (error) throw error;
    },
    listYoloClasses: async (clienteId: string): Promise<SentinelaYoloClassConfig[]> => {
      const { data, error } = await supabase
        .from('sentinela_yolo_class_config')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('item_key');
      if (error) throw error;
      return (data as SentinelaYoloClassConfig[]) || [];
    },
    updateYoloClass: async (id: string, payload: Partial<SentinelaYoloClassConfig>): Promise<void> => {
      const { error } = await supabase
        .from('sentinela_yolo_class_config')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    listSynonyms: async (clienteId: string): Promise<import('@/types/database').SentinelaYoloSynonym[]> => {
      const { data, error } = await supabase
        .from('sentinela_yolo_synonym')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('synonym');
      if (error) throw error;
      return (data as import('@/types/database').SentinelaYoloSynonym[]) || [];
    },
    addSynonym: async (clienteId: string, synonym: string, maps_to: string): Promise<void> => {
      const { error } = await supabase
        .from('sentinela_yolo_synonym')
        .insert({ cliente_id: clienteId, synonym: synonym.trim().toLowerCase(), maps_to: maps_to.trim().toLowerCase() });
      if (error) throw error;
    },
    deleteSynonym: async (id: string): Promise<void> => {
      const { error } = await supabase.from('sentinela_yolo_synonym').delete().eq('id', id);
      if (error) throw error;
    },
  },

  /**
   * Editor de sub-tabelas de políticas de risco pluviométrico (TabBins, TabFactors, etc.).
   * Opera por policyId — não por clienteId (a política já está isolada por cliente via FK).
   */
  riskPolicyEditor: {
    // ── Defaults ───────────────────────────────────────────────────────────────
    getDefaults: async (policyId: string): Promise<SentinelaRiskDefaults | null> => {
      const { data } = await supabase
        .from('sentinela_risk_defaults')
        .select('*')
        .eq('policy_id', policyId)
        .maybeSingle();
      return data as SentinelaRiskDefaults | null;
    },
    upsertDefaults: async (policyId: string, payload: Omit<SentinelaRiskDefaults, 'id' | 'policy_id' | 'created_at'>, existingId?: string): Promise<SentinelaRiskDefaults> => {
      if (existingId) {
        const { data, error } = await supabase
          .from('sentinela_risk_defaults')
          .update({ policy_id: policyId, ...payload })
          .eq('id', existingId)
          .select()
          .single();
        if (error) throw error;
        return data as SentinelaRiskDefaults;
      } else {
        const { data, error } = await supabase
          .from('sentinela_risk_defaults')
          .insert({ policy_id: policyId, ...payload })
          .select()
          .single();
        if (error) throw error;
        return data as SentinelaRiskDefaults;
      }
    },

    // ── Bins ──────────────────────────────────────────────────────────────────
    listBins: async (tableKey: string, policyId: string): Promise<{ id?: string; idx: number; min_val: number; max_val: number }[]> => {
      const { data } = await supabase.from(tableKey).select('*').eq('policy_id', policyId).order('idx');
      return (data || []).map((d: Record<string, unknown>) => ({ id: d.id as string, idx: d.idx as number, min_val: d.min_val as number, max_val: d.max_val as number }));
    },
    replaceBins: async (tableKey: string, policyId: string, rows: { idx: number; min_val: number; max_val: number }[]): Promise<void> => {
      await supabase.from(tableKey).delete().eq('policy_id', policyId);
      if (rows.length > 0) {
        const { error } = await supabase.from(tableKey).insert(rows.map((r, i) => ({ policy_id: policyId, idx: i, min_val: r.min_val, max_val: r.max_val })));
        if (error) throw error;
      }
    },

    // ── Factors ───────────────────────────────────────────────────────────────
    listFactors: async (tableKey: string, policyId: string, minField: string, maxField: string): Promise<{ id?: string; idx: number; min_val: number; max_val: number; factor: number }[]> => {
      const { data } = await supabase.from(tableKey).select('*').eq('policy_id', policyId).order('idx');
      return (data || []).map((d: Record<string, unknown>) => ({ id: d.id as string, idx: d.idx as number, min_val: d[minField] as number, max_val: d[maxField] as number, factor: d.factor as number }));
    },
    replaceFactors: async (tableKey: string, policyId: string, minField: string, maxField: string, rows: { idx: number; min_val: number; max_val: number; factor: number }[]): Promise<void> => {
      await supabase.from(tableKey).delete().eq('policy_id', policyId);
      if (rows.length > 0) {
        const { error } = await supabase.from(tableKey).insert(rows.map((r, i) => ({ policy_id: policyId, idx: i, [minField]: r.min_val, [maxField]: r.max_val, factor: r.factor })));
        if (error) throw error;
      }
    },

    // ── Adjustments ───────────────────────────────────────────────────────────
    listAdjusts: async (tableKey: string, policyId: string, minField: string, maxField: string): Promise<{ id?: string; idx: number; min_val: number; max_val: number; delta_pp: number }[]> => {
      const { data } = await supabase.from(tableKey).select('*').eq('policy_id', policyId).order('idx');
      return (data || []).map((d: Record<string, unknown>) => ({ id: d.id as string, idx: d.idx as number, min_val: d[minField] as number, max_val: d[maxField] as number, delta_pp: d.delta_pp as number }));
    },
    replaceAdjusts: async (tableKey: string, policyId: string, minField: string, maxField: string, rows: { idx: number; min_val: number; max_val: number; delta_pp: number }[]): Promise<void> => {
      await supabase.from(tableKey).delete().eq('policy_id', policyId);
      if (rows.length > 0) {
        const { error } = await supabase.from(tableKey).insert(rows.map((r, i) => ({ policy_id: policyId, idx: i, [minField]: r.min_val, [maxField]: r.max_val, delta_pp: r.delta_pp })));
        if (error) throw error;
      }
    },
    listTendenciaAdjusts: async (policyId: string): Promise<{ id?: string; tendencia: TendenciaTipo; delta_pp: number }[]> => {
      const { data } = await supabase.from('sentinela_risk_tendencia_adjust_pp').select('*').eq('policy_id', policyId);
      return (data || []).map((d: Record<string, unknown>) => ({ id: d.id as string, tendencia: d.tendencia as TendenciaTipo, delta_pp: d.delta_pp as number }));
    },
    replaceTendenciaAdjusts: async (policyId: string, rows: { tendencia: TendenciaTipo; delta_pp: number }[]): Promise<void> => {
      await supabase.from('sentinela_risk_tendencia_adjust_pp').delete().eq('policy_id', policyId);
      if (rows.length > 0) {
        const { error } = await supabase.from('sentinela_risk_tendencia_adjust_pp').insert(rows.map(t => ({ policy_id: policyId, tendencia: t.tendencia, delta_pp: t.delta_pp })));
        if (error) throw error;
      }
    },

    // ── Rules ─────────────────────────────────────────────────────────────────
    listRules: async (policyId: string): Promise<SentinelaRiskRule[]> => {
      const { data } = await supabase.from('sentinela_risk_rule').select('*').eq('policy_id', policyId).order('idx');
      return (data || []) as SentinelaRiskRule[];
    },
    replaceRules: async (policyId: string, rows: Omit<SentinelaRiskRule, 'id' | 'policy_id' | 'created_at'>[]): Promise<void> => {
      await supabase.from('sentinela_risk_rule').delete().eq('policy_id', policyId);
      if (rows.length > 0) {
        const { error } = await supabase.from('sentinela_risk_rule').insert(rows.map((r, i) => ({ ...r, policy_id: policyId, idx: i })));
        if (error) throw error;
      }
    },
    getFallbackRule: async (policyId: string): Promise<SentinelaRiskFallbackRule | null> => {
      const { data } = await supabase.from('sentinela_risk_fallback_rule').select('*').eq('policy_id', policyId).maybeSingle();
      return data as SentinelaRiskFallbackRule | null;
    },
    upsertFallbackRule: async (policyId: string, payload: Omit<SentinelaRiskFallbackRule, 'id' | 'policy_id' | 'created_at'>, existingId?: string): Promise<string> => {
      if (existingId) {
        const { error } = await supabase.from('sentinela_risk_fallback_rule').update(payload).eq('id', existingId);
        if (error) throw error;
        return existingId;
      } else {
        const { data, error } = await supabase.from('sentinela_risk_fallback_rule').insert({ ...payload, policy_id: policyId }).select().single();
        if (error) throw error;
        return (data as { id: string }).id;
      }
    },

    // ── Import (bulk replace all tables) ──────────────────────────────────────
    importAll: async (policyId: string, parsed: {
      defaults?: { chuva_relevante_mm: number; dias_lookup_max: number; tendencia_dias: number; janela_sem_chuva_bins?: number[][]; intensidade_chuva_bins?: number[][]; persistencia_7d_bins?: number[][] };
      fallback_rule?: Partial<SentinelaRiskFallbackRule>;
      rules?: Partial<SentinelaRiskRule>[];
      temp_factors?: Partial<SentinelaRiskTempFactor>[];
      vento_factors?: Partial<SentinelaRiskVentoFactor>[];
      temp_adjust_pp?: Partial<SentinelaRiskTempAdjustPp>[];
      vento_adjust_pp?: Partial<SentinelaRiskVentoAdjustPp>[];
      persistencia_adjust_pp?: Partial<SentinelaRiskPersistenciaAdjustPp>[];
      tendencia_adjust_pp?: Partial<SentinelaRiskTendenciaAdjustPp>[];
    }): Promise<string[]> => {
      const log: string[] = [];
      const run = async (label: string, fn: () => Promise<void>) => {
        await fn();
        log.push(`✅ ${label}`);
      };

      if (parsed.defaults) {
        const d = parsed.defaults;
        await supabase.from('sentinela_risk_defaults').delete().eq('policy_id', policyId);
        const { error } = await supabase.from('sentinela_risk_defaults').insert({ policy_id: policyId, chuva_relevante_mm: d.chuva_relevante_mm, dias_lookup_max: d.dias_lookup_max, tendencia_dias: d.tendencia_dias });
        if (error) throw new Error('Defaults: ' + error.message);
        log.push('✅ Defaults importados');
        if (d.janela_sem_chuva_bins) {
          await run(`${d.janela_sem_chuva_bins.length} bins "sem chuva" importados`, async () => {
            await supabase.from('sentinela_risk_bin_sem_chuva').delete().eq('policy_id', policyId);
            const { error: e } = await supabase.from('sentinela_risk_bin_sem_chuva').insert(d.janela_sem_chuva_bins!.map((b, i) => ({ policy_id: policyId, idx: i, min_val: b[0], max_val: b[1] })));
            if (e) throw new Error('Bins sem chuva: ' + e.message);
          });
        }
        if (d.intensidade_chuva_bins) {
          await run(`${d.intensidade_chuva_bins.length} bins "intensidade chuva" importados`, async () => {
            await supabase.from('sentinela_risk_bin_intensidade_chuva').delete().eq('policy_id', policyId);
            const { error: e } = await supabase.from('sentinela_risk_bin_intensidade_chuva').insert(d.intensidade_chuva_bins!.map((b, i) => ({ policy_id: policyId, idx: i, min_val: b[0], max_val: b[1] })));
            if (e) throw new Error('Bins intensidade: ' + e.message);
          });
        }
        if (d.persistencia_7d_bins) {
          await run(`${d.persistencia_7d_bins.length} bins "persistência 7d" importados`, async () => {
            await supabase.from('sentinela_risk_bin_persistencia_7d').delete().eq('policy_id', policyId);
            const { error: e } = await supabase.from('sentinela_risk_bin_persistencia_7d').insert(d.persistencia_7d_bins!.map((b, i) => ({ policy_id: policyId, idx: i, min_val: b[0], max_val: b[1] })));
            if (e) throw new Error('Bins persistência: ' + e.message);
          });
        }
      }
      if (parsed.fallback_rule) {
        await supabase.from('sentinela_risk_fallback_rule').delete().eq('policy_id', policyId);
        const { error } = await supabase.from('sentinela_risk_fallback_rule').insert({ policy_id: policyId, ...parsed.fallback_rule });
        if (error) throw new Error('Fallback: ' + error.message);
        log.push('✅ Fallback rule importada');
      }
      if (parsed.rules?.length) {
        await supabase.from('sentinela_risk_rule').delete().eq('policy_id', policyId);
        const { error } = await supabase.from('sentinela_risk_rule').insert(parsed.rules.map((r, i) => ({ policy_id: policyId, idx: i, ...r })));
        if (error) throw new Error('Rules: ' + error.message);
        log.push(`✅ ${parsed.rules.length} regras importadas`);
      }
      const tableImports: [string, string, Partial<Record<string, unknown>>[] | undefined, string][] = [
        ['sentinela_risk_temp_factor', 'Temp factors', parsed.temp_factors, 'fatores de temperatura'],
        ['sentinela_risk_vento_factor', 'Vento factors', parsed.vento_factors, 'fatores de vento'],
        ['sentinela_risk_temp_adjust_pp', 'Temp adjust', parsed.temp_adjust_pp, 'ajustes temperatura PP'],
        ['sentinela_risk_vento_adjust_pp', 'Vento adjust', parsed.vento_adjust_pp, 'ajustes vento PP'],
        ['sentinela_risk_persistencia_adjust_pp', 'Persistência adjust', parsed.persistencia_adjust_pp, 'ajustes persistência PP'],
      ];
      for (const [table, errLabel, rows, label] of tableImports) {
        if (rows?.length) {
          await supabase.from(table).delete().eq('policy_id', policyId);
          const { error } = await supabase.from(table).insert(rows.map((r, i) => ({ policy_id: policyId, idx: i, ...r })));
          if (error) throw new Error(`${errLabel}: ${error.message}`);
          log.push(`✅ ${rows.length} ${label} importados`);
        }
      }
      if (parsed.tendencia_adjust_pp?.length) {
        await supabase.from('sentinela_risk_tendencia_adjust_pp').delete().eq('policy_id', policyId);
        const { error } = await supabase.from('sentinela_risk_tendencia_adjust_pp').insert(parsed.tendencia_adjust_pp.map(r => ({ policy_id: policyId, ...r })));
        if (error) throw new Error('Tendência adjust: ' + error.message);
        log.push(`✅ ${parsed.tendencia_adjust_pp.length} ajustes tendência PP importados`);
      }
      return log;
    },
  },

  // ── MÓDULO 1 — LIRAa ───────────────────────────────────────────────────────
  liraa: {
    calcular: async (clienteId: string, ciclo: number) => {
      const { data, error } = await supabase.rpc('rpc_calcular_liraa', {
        p_cliente_id: clienteId,
        p_ciclo: ciclo,
      });
      if (error) throw error;
      return data;
    },
    consumoLarvicida: async (clienteId: string, ciclo: number): Promise<ConsumoLarvicida[]> => {
      const { data, error } = await supabase.rpc('rpc_consumo_larvicida', {
        p_cliente_id: clienteId,
        p_ciclo: ciclo,
      });
      if (error) throw error;
      return (data || []) as ConsumoLarvicida[];
    },

    /** Lista dados LIRAa por quarteirão a partir da view v_liraa_quarteirao. */
    listPorQuarteirao: async (clienteId: string, ciclo?: number) => {
      let q = supabase
        .from('v_liraa_quarteirao')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('bairro', { ascending: true })
        .order('quarteirao', { ascending: true });
      if (ciclo !== undefined) q = q.eq('ciclo', ciclo);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },

    /** Lista ciclos com vistorias registradas para o cliente. */
    listCiclosDisponiveis: async (clienteId: string): Promise<number[]> => {
      const { data, error } = await supabase
        .from('vistorias')
        .select('ciclo')
        .eq('cliente_id', clienteId)
        .not('ciclo', 'is', null)
        .order('ciclo', { ascending: false });
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.ciclo as number))];
    },

    /** Invoca a Edge Function liraa-export para gerar o relatório HTML. */
    exportarPdf: async (clienteId: string, ciclo: number): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('liraa-export', {
        body: { cliente_id: clienteId, ciclo },
      });
      if (error) throw error;
      // Abre em nova aba para impressão via window.print()
      const blob = new Blob([data as string], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  },

  // ── Quarteirões (tabela mestre) ────────────────────────────────────────────
  quarteiroes: {
    listByCliente: async (clienteId: string): Promise<Quarteirao[]> => {
      const { data, error } = await supabase
        .from('quarteiroes')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('codigo', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  },

  // ── Distribuição de Quarteirões ────────────────────────────────────────────
  distribuicaoQuarteirao: {
    listByCiclo: async (clienteId: string, ciclo: number): Promise<DistribuicaoQuarteirao[]> => {
      const { data, error } = await supabase
        .from('distribuicao_quarteirao')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('ciclo', ciclo);
      if (error) throw error;
      return data || [];
    },

    listByAgente: async (clienteId: string, agenteId: string, ciclo: number): Promise<string[]> => {
      const { data, error } = await supabase
        .from('distribuicao_quarteirao')
        .select('quarteirao')
        .eq('cliente_id', clienteId)
        .eq('agente_id', agenteId)
        .eq('ciclo', ciclo);
      if (error) throw error;
      return (data || []).map((r) => r.quarteirao as string);
    },

    upsert: async (rows: Omit<DistribuicaoQuarteirao, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> => {
      if (rows.length === 0) return;
      const { error } = await supabase
        .from('distribuicao_quarteirao')
        .upsert(rows, { onConflict: 'cliente_id,ciclo,quarteirao' });
      if (error) throw error;
    },

    deletar: async (clienteId: string, ciclo: number, quarteiroes: string[]): Promise<void> => {
      if (quarteiroes.length === 0) return;
      const { error } = await supabase
        .from('distribuicao_quarteirao')
        .delete()
        .eq('cliente_id', clienteId)
        .eq('ciclo', ciclo)
        .in('quarteirao', quarteiroes);
      if (error) throw error;
    },

    copiarDoCiclo: async (clienteId: string, cicloOrigem: number, cicloDestino: number): Promise<number> => {
      const { data, error } = await supabase.rpc('copiar_distribuicao_ciclo', {
        p_cliente_id: clienteId,
        p_ciclo_origem: cicloOrigem,
        p_ciclo_destino: cicloDestino,
      });
      if (error) throw error;
      return (data as number) || 0;
    },

    coberturaByCliente: async (clienteId: string, ciclo: number): Promise<CoberturaQuarteirao[]> => {
      const { data, error } = await supabase.rpc('cobertura_quarteirao_ciclo', {
        p_cliente_id: clienteId,
        p_ciclo: ciclo,
      });
      if (error) throw error;
      return (data || []) as CoberturaQuarteirao[];
    },
  },

  // ── MÓDULO 2 — Produtividade de agentes ────────────────────────────────────
  // (método adicionado em api.vistorias via extensão abaixo)

  // ── MÓDULO 4 — Score Preditivo de Surto ────────────────────────────────────
  scoreSurto: {
    porRegiao: async (clienteId: string) => {
      const { data, error } = await supabase.rpc('rpc_score_surto_regioes', {
        p_cliente_id: clienteId,
      });
      if (error) throw error;
      return (data || []);
    },
  },

  // ── MÓDULO 3 — Protocolo de notificação formal ─────────────────────────────
  notificacaoFormal: {
    gerarProtocolo: async (clienteId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('proximo_protocolo_notificacao', {
        p_cliente_id: clienteId,
      });
      if (error) throw error;
      return data as string;
    },
  },

  // ── MÓDULO 6 — YOLO Qualidade ──────────────────────────────────────────────
  yoloQualidade: {
    resumo: async (clienteId: string) => {
      const { data: correlacoes, error } = await supabase
        .from('vistoria_drone_correlacao')
        .select('id, distancia_metros, drone_detectou_foco, campo_confirmou_foco, levantamento_item_id, levantamento_itens(endereco_curto, risco)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const total = correlacoes?.length ?? 0;
      const comConfirmacao = correlacoes?.filter((c) => c.campo_confirmou_foco !== null) ?? [];
      const confirmados = comConfirmacao.filter((c) => c.campo_confirmou_foco === true).length;
      const precisao = comConfirmacao.length > 0 ? Math.round((confirmados / comConfirmacao.length) * 100) : 0;
      const falsosPositivos = comConfirmacao.length > 0 ? Math.round(((comConfirmacao.length - confirmados) / comConfirmacao.length) * 100) : 0;
      const droneDetectou = correlacoes?.filter((c) => c.drone_detectou_foco).length ?? 0;
      const cobertura = droneDetectou > 0 ? Math.round((comConfirmacao.length / droneDetectou) * 100) : 0;

      return {
        precisao_estimada: precisao,
        taxa_falsos_positivos: falsosPositivos,
        total_correlacoes: total,
        cobertura,
        evolucao_mensal: [] as { mes: string; precisao: number }[],
        correlacoes: (correlacoes ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          endereco: (c.levantamento_itens as Record<string, string> | null)?.endereco_curto ?? '—',
          risco_drone: (c.levantamento_itens as Record<string, string> | null)?.risco ?? '—',
          confirmado_campo: c.campo_confirmou_foco as boolean | null,
          distancia_metros: c.distancia_metros as number,
        })),
      };
    },
  },

  // ── MÓDULO 7 — Resumos diários ─────────────────────────────────────────────
  resumosDiarios: {
    list: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('resumos_diarios')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_ref', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    gerar: async (clienteId: string) => {
      const { data, error } = await supabase.functions.invoke('resumo-diario', {
        body: { cliente_id: clienteId },
      });
      if (error) throw error;
      return data;
    },
  },

  /** IA Insights — cache de respostas Claude Haiku por cliente. */
  iaInsights: {
    getResumo: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('ia_insights')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'resumo_diario')
        .gt('valido_ate', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    gerar: async (clienteId: string, forceRefresh = false) => {
      const { data, error } = await supabase.functions.invoke('resumo-diario', {
        body: { cliente_id: clienteId, force_refresh: forceRefresh },
      });
      if (error) throw error;
      return data;
    },
  },

  /** Focos de risco territorial — Aggregate Root do ciclo operacional. */
  focosRisco: {
    /** Lista focos via view com filtros opcionais.
     *  Usa v_focos_risco_todos quando o filtro inclui estados terminais (resolvido/descartado),
     *  e v_focos_risco_ativos nos demais casos (exclui terminais por definição). */
    list: async (clienteId: string, filtros?: FocoRiscoFiltros): Promise<{ data: FocoRiscoAtivo[]; count: number }> => {
      const page     = filtros?.page     ?? 1;
      const pageSize = filtros?.pageSize ?? 50;
      const from     = (page - 1) * pageSize;
      const to       = from + pageSize - 1;

      const TERMINAL: FocoRiscoStatus[] = ['resolvido', 'descartado'];
      const usarViewCompleta = filtros?.status?.some((s) => TERMINAL.includes(s as FocoRiscoStatus)) ?? false;

      // Ordenação configurável — padrão FIFO (mais antigos primeiro) para triagem operacional
      const orderMap: Record<string, { col: string; asc: boolean }> = {
        suspeita_em_asc:       { col: 'suspeita_em',       asc: true  },
        suspeita_em_desc:      { col: 'suspeita_em',       asc: false },
        score_prioridade_desc: { col: 'score_prioridade',  asc: false },
      };
      const ord = orderMap[filtros?.orderBy ?? 'suspeita_em_asc'] ?? orderMap.suspeita_em_asc;

      let q = supabase
        .from(usarViewCompleta ? 'v_focos_risco_todos' : 'v_focos_risco_ativos')
        .select('*', { count: 'exact' })
        .eq('cliente_id', clienteId)
        .order(ord.col, { ascending: ord.asc })
        .range(from, to);

      if (filtros?.status?.length)       q = q.in('status', filtros.status);
      if (filtros?.prioridade?.length)   q = q.in('prioridade', filtros.prioridade);
      if (filtros?.regiao_id)            q = q.eq('regiao_id', filtros.regiao_id);
      if (filtros?.ciclo)                q = q.eq('ciclo', filtros.ciclo);
      if (filtros?.origem_tipo)          q = q.eq('origem_tipo', filtros.origem_tipo);
      if (filtros?.imovel_id)            q = q.eq('imovel_id', filtros.imovel_id);
      if (filtros?.responsavel_id)           q = q.eq('responsavel_id', filtros.responsavel_id);
      if (filtros?.semResponsavel)           q = q.is('responsavel_id', null);
      if (filtros?.classificacao_inicial)    q = q.eq('classificacao_inicial', filtros.classificacao_inicial);
      if (filtros?.de)                       q = q.gte('suspeita_em', filtros.de.toISOString());
      if (filtros?.ate)                      q = q.lte('suspeita_em', filtros.ate.toISOString());

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: (data || []) as FocoRiscoAtivo[], count: count ?? 0 };
    },

    /**
     * Contagens agregadas para a fila de triagem (mesmos filtros da list, sem paginação).
     * Evita KPIs calculados só sobre a página atual.
     */
    contagemTriagemFila: async (
      clienteId: string,
      filtros?: FocoRiscoFiltros,
    ): Promise<{
      total: number;
      suspeita: number;
      em_triagem: number;
      aguarda_inspecao: number;
      p1p2: number;
      sem_responsavel: number;
    em_inspecao: number;
    }> => {
      const allowedStatuses: FocoRiscoStatus[] =
        filtros?.status?.length && filtros.status.length > 0
          ? filtros.status
          : ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao'];

      const applyCommon = () => {
        let q = supabase
          .from('v_focos_risco_ativos')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', clienteId);
        if (filtros?.prioridade?.length) q = q.in('prioridade', filtros.prioridade);
        if (filtros?.regiao_id) q = q.eq('regiao_id', filtros.regiao_id);
        if (filtros?.ciclo) q = q.eq('ciclo', filtros.ciclo);
        if (filtros?.origem_tipo) q = q.eq('origem_tipo', filtros.origem_tipo);
        if (filtros?.imovel_id) q = q.eq('imovel_id', filtros.imovel_id);
        if (filtros?.responsavel_id) q = q.eq('responsavel_id', filtros.responsavel_id);
        if (filtros?.semResponsavel) q = q.is('responsavel_id', null);
        if (filtros?.classificacao_inicial) q = q.eq('classificacao_inicial', filtros.classificacao_inicial);
        if (filtros?.de) q = q.gte('suspeita_em', filtros.de.toISOString());
        if (filtros?.ate) q = q.lte('suspeita_em', filtros.ate.toISOString());
        return q;
      };

      const countInStatuses = async (statuses: string[]) => {
        const intersection = statuses.filter((s) => allowedStatuses.includes(s as FocoRiscoStatus));
        if (intersection.length === 0) return 0;
        const { count, error } = await applyCommon().in('status', intersection);
        if (error) throw error;
        return count ?? 0;
      };

      const countP1P2 = async () => {
        const { count, error } = await applyCommon()
          .in('status', allowedStatuses)
          .in('prioridade', ['P1', 'P2']);
        if (error) throw error;
        return count ?? 0;
      };

      const countSemResp = async () => {
        const { count, error } = await applyCommon()
          .in('status', allowedStatuses)
          .is('responsavel_id', null);
        if (error) throw error;
        return count ?? 0;
      };

      const [total, suspeita, em_triagem, aguarda_inspecao, em_inspecao, p1p2, sem_responsavel] =
        await Promise.all([
          countInStatuses([...allowedStatuses]),
          countInStatuses(['suspeita']),
          countInStatuses(['em_triagem']),
          countInStatuses(['aguarda_inspecao']),
          countInStatuses(['em_inspecao']),
          countP1P2(),
          countSemResp(),
        ]);

      return {
        total,
        suspeita,
        em_triagem,
        aguarda_inspecao,
        em_inspecao,
        p1p2,
        sem_responsavel,
      };
    },

    /** Uma linha da view ativa por id (dados frescos no painel lateral). */
    getAtivoById: async (id: string): Promise<FocoRiscoAtivo | null> => {
      const { data, error } = await supabase
        .from('v_focos_risco_ativos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as FocoRiscoAtivo | null;
    },

    /** Vincula um imóvel a um foco (enriquecimento de dado — não é transição de status). */
    vincularImovel: async (focoId: string, imovelId: string): Promise<void> => {
      const { error } = await supabase
        .from('focos_risco')
        .update({ imovel_id: imovelId })
        .eq('id', focoId);
      if (error) throw error;
    },

    /** Busca foco por ID incluindo terminais (resolvido/descartado) via v_focos_risco_todos. */
    getPorId: async (id: string): Promise<FocoRiscoAtivo | null> => {
      const { data, error } = await supabase
        .from('v_focos_risco_todos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as FocoRiscoAtivo | null;
    },

    /** Busca foco por ID com histórico de transições. */
    get: async (id: string): Promise<{ foco: FocoRisco; historico: FocoRiscoHistorico[] } | null> => {
      const [foco, historico] = await Promise.all([
        api.focosRisco.getById(id),
        api.focosRisco.historico(id),
      ]);
      if (!foco) return null;
      return { foco, historico };
    },

    /** Busca um foco pelo id (tabela base, não a view). */
    getById: async (id: string): Promise<FocoRisco | null> => {
      const { data, error } = await supabase
        .from('focos_risco')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data as FocoRisco | null;
    },

    /** Histórico de transições de um foco, ordem cronológica. */
    historico: async (focoId: string): Promise<FocoRiscoHistorico[]> => {
      const { data, error } = await supabase
        .from('foco_risco_historico')
        .select('*')
        .eq('foco_risco_id', focoId)
        .order('alterado_em', { ascending: true });
      if (error) throw error;
      return (data || []) as FocoRiscoHistorico[];
    },

    /** Timeline unificada (estados + vistorias + SLA + casos). */
    timeline: async (focoId: string): Promise<FocoRiscoTimelineItem[]> => {
      const { data, error } = await supabase
        .from('v_foco_risco_timeline')
        .select('*')
        .eq('foco_risco_id', focoId)
        .order('ts', { ascending: false });
      if (error) throw error;
      return (data || []) as FocoRiscoTimelineItem[];
    },

    /** Cria foco manualmente (origem_tipo='manual'). */
    criar: async (payload: {
      cliente_id: string;
      imovel_id?: string;
      regiao_id?: string;
      latitude?: number;
      longitude?: number;
      prioridade?: FocoRiscoPrioridade;
      endereco_normalizado?: string;
      responsavel_id?: string;
      desfecho?: string;
    }): Promise<FocoRisco> => {
      const { data, error } = await supabase
        .from('focos_risco')
        .insert({ ...payload, origem_tipo: 'manual' })
        .select()
        .single();
      if (error) throw error;
      return data as FocoRisco;
    },

    /** Transiciona estado via RPC (validação de state machine no banco). */
    transicionar: async (
      focoId: string,
      statusNovo: FocoRiscoStatus,
      motivo?: string,
      responsavelId?: string,
    ): Promise<{ id: string; status: FocoRiscoStatus; confirmado_em: string | null; resolvido_em: string | null; updated_at: string }> => {
      const { data, error } = await supabase.rpc('rpc_transicionar_foco_risco', {
        p_foco_id:        focoId,
        p_status_novo:    statusNovo,
        p_motivo:         motivo         ?? null,
        p_responsavel_id: responsavelId  ?? null,
      });
      if (error) logAndThrow(error, 'focosRisco.transicionar', { focoId, statusNovo });
      return data as { id: string; status: FocoRiscoStatus; confirmado_em: string | null; resolvido_em: string | null; updated_at: string };
    },

    /**
     * Distribui um foco para um agente (gestor only).
     * em_triagem → aguarda_inspecao + define responsável.
     * aguarda_inspecao → mantém status, apenas troca o responsável (reatribuição).
     */
    atribuirAgente: async (focoId: string, agenteId: string, motivo?: string): Promise<void> => {
      const { error } = await supabase.rpc('rpc_atribuir_agente_foco', {
        p_foco_id:   focoId,
        p_agente_id: agenteId,
        p_motivo:    motivo ?? null,
      });
      if (error) logAndThrow(error, 'focosRisco.atribuirAgente', { focoId, agenteId });
    },

    /** Distribui múltiplos focos a um agente em lote (triagem territorial).
     *  Retorna { atribuidos, ignorados } — focos em execução são ignorados. */
    atribuirAgenteLote: async (
      focoIds: string[],
      agenteId: string,
      motivo?: string,
    ): Promise<{ atribuidos: number; ignorados: number }> => {
      const { data, error } = await supabase.rpc('rpc_atribuir_agente_foco_lote', {
        p_foco_ids:  focoIds,
        p_agente_id: agenteId,
        p_motivo:    motivo ?? null,
      });
      if (error) logAndThrow(error, 'focosRisco.atribuirAgenteLote', { focoIds, agenteId });
      return data as { atribuidos: number; ignorados: number };
    },

    /** Agrupamento territorial de focos ativos via v_focos_risco_agrupados.
     *  Hierarquia: quadra > bairro > regiao > item. */
    agrupados: async (clienteId: string): Promise<import('@/types/database').FocoRiscoAgrupado[]> => {
      const { data, error } = await supabase
        .from('v_focos_risco_agrupados')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('prioridade_max_ord', { ascending: true, nullsFirst: false })
        .order('quantidade_focos', { ascending: false });
      if (error) throw error;
      return (data || []) as import('@/types/database').FocoRiscoAgrupado[];
    },

    /** Busca focos enriquecidos por lista de IDs (drill-down de grupo territorial).
     *  Usa v_focos_risco_ativos — retorna apenas focos ativos (não terminais). */
    listByIds: async (ids: string[]): Promise<FocoRiscoAtivo[]> => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('v_focos_risco_ativos')
        .select(
          'id, status, prioridade, codigo_foco, logradouro, numero, bairro, ' +
          'quarteirao, regiao_nome, responsavel_nome, responsavel_id, ' +
          'sla_status, sla_prazo_em, endereco_normalizado, imovel_id',
        )
        .in('id', ids)
        .order('score_prioridade', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FocoRiscoAtivo[];
    },

    /** Altera classificação inicial via RPC — registra no foco_risco_historico. */
    atualizarClassificacao: async (
      focoId: string,
      classificacao: FocoRiscoClassificacao,
    ): Promise<{ ok: boolean; changed?: boolean; de?: string; para?: string; error?: string }> => {
      const { data, error } = await supabase.rpc('rpc_atualizar_classificacao_inicial', {
        p_foco_id:       focoId,
        p_classificacao: classificacao,
      });
      if (error) throw error;
      return data as { ok: boolean; changed?: boolean; de?: string; para?: string; error?: string };
    },

    /** Atualiza metadados não-status (responsável, desfecho). prioridade e regiao_id são intencionalmente excluídos — usam RPCs próprias. */
    update: async (id: string, payload: Partial<Pick<FocoRisco, 'responsavel_id' | 'desfecho'>>): Promise<void> => {
      const { error } = await supabase.from('focos_risco').update(payload).eq('id', id);
      if (error) throw error;
    },

    /** View analítica com campos calculados (tempo_total_horas, sla_cumprido, reincidência, etc). */
    analytics: async (
      clienteId: string,
      filtros?: { de?: Date; ate?: Date; status?: FocoRiscoStatus[]; regiao_id?: string },
    ): Promise<FocoRiscoAnalytics[]> => {
      let q = supabase
        .from('v_focos_risco_analytics')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('suspeita_em', { ascending: false });

      if (filtros?.de)          q = q.gte('suspeita_em', filtros.de.toISOString());
      if (filtros?.ate)         q = q.lte('suspeita_em', filtros.ate.toISOString());
      if (filtros?.status?.length) q = q.in('status', filtros.status);
      if (filtros?.regiao_id)   q = q.eq('regiao_id', filtros.regiao_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FocoRiscoAnalytics[];
    },

    /** Resumo agregado por região via RPC. */
    resumoRegional: async (
      clienteId: string,
      opcoes?: { ciclo?: number; de?: Date; ate?: Date },
    ): Promise<ResumoRegional[]> => {
      const { data, error } = await supabase.rpc('rpc_resumo_regional', {
        p_cliente_id: clienteId,
        p_ciclo:      opcoes?.ciclo ?? null,
        p_de:         opcoes?.de?.toISOString()  ?? null,
        p_ate:        opcoes?.ate?.toISOString() ?? null,
      });
      if (error) throw error;
      return (data as ResumoRegional[]) || [];
    },

    /** Busca o foco vinculado a um levantamento_item (origem_levantamento_item_id). */
    byLevantamentoItem: async (itemId: string, clienteId?: string): Promise<FocoRiscoAtivo | null> => {
      let q = supabase
        .from('v_focos_risco_ativos')
        .select('*')
        .eq('origem_levantamento_item_id', itemId);
      if (clienteId) q = q.eq('cliente_id', clienteId);
      q = q.order('created_at', { ascending: false }).limit(1);
      const { data, error } = await q;
      if (error) throw error;
      return (data?.[0] ?? null) as FocoRiscoAtivo | null;
    },

    /** Focos ativos vinculados a um imóvel específico — para alertar agente/operador. */
    listByImovel: async (imovelId: string, clienteId: string): Promise<FocoRiscoAtivo[]> => {
      const { data, error } = await supabase
        .from('v_focos_risco_ativos')
        .select('id, status, prioridade, suspeita_em, origem_tipo, sla_status, sla_prazo_em')
        .eq('imovel_id', imovelId)
        .eq('cliente_id', clienteId)
        .order('suspeita_em', { ascending: false });
      if (error) throw error;
      return (data || []) as FocoRiscoAtivo[];
    },

    /** Contagem de focos por status para o cliente (dashboard). */
    contagemPorStatus: async (clienteId: string): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('focos_risco')
        .select('status')
        .eq('cliente_id', clienteId)
        .is('deleted_at', null) // Fix S-09
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(({ status }: { status: string }) => {
        counts[status] = (counts[status] ?? 0) + 1;
      });
      return counts;
    },

    /** Inicia inspeção de campo de forma explícita e idempotente. Chama fn_iniciar_inspecao_foco. */
    iniciarInspecao: async (focoId: string, observacao?: string): Promise<{ ok: boolean; ja_em_inspecao: boolean }> => {
      const { data, error } = await supabase.rpc('fn_iniciar_inspecao_foco', {
        p_foco_id:    focoId,
        p_observacao: observacao ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; ja_em_inspecao: boolean };
    },

    /** Retorna o detalhamento de dados mínimos de um foco (view v_focos_dados_minimos_status). */
    dadosMinimos: async (focoId: string): Promise<FocoDadosMinimosStatus | null> => {
      const { data, error } = await supabase
        .from('v_focos_dados_minimos_status')
        .select('*')
        .eq('foco_id', focoId)
        .maybeSingle();
      if (error) throw error;
      return data as FocoDadosMinimosStatus | null;
    },
  },

  /** QW-09 Correção 3: Persiste falhas de sincronização offline para rastreabilidade. */
  offlineSyncLog: {
    registrar: async (payload: {
      operacao: string;
      erro: string;
      usuario_id?: string | null;
      retry_count?: number;
      idempotency_key?: string | null;
      cliente_id?: string | null;
    }): Promise<void> => {
      const { error } = await supabase
        .from('offline_sync_log')
        .insert({
          operacao:         payload.operacao,
          erro:             payload.erro,
          usuario_id:       payload.usuario_id       ?? null,
          retry_count:      payload.retry_count      ?? 0,
          idempotency_key:  payload.idempotency_key  ?? null,
          cliente_id:       payload.cliente_id       ?? null,
        });
      // Silently ignore — log failure must not disrupt the drain loop
      if (error) console.warn('[offlineSyncLog] Falha ao registrar:', error.message);
    },
  },

  /** QW-13: Fila de jobs assíncronos. */
  jobQueue: {
    /** Enfileira um job. Retorna o id do job criado. */
    enqueue: async (tipo: JobTipo, payload: Record<string, unknown> = {}): Promise<string> => {
      const { data, error } = await supabase.rpc('fn_enqueue_job', {
        p_tipo: tipo,
        p_payload: payload,
      });
      if (error) throw error;
      return data as string;
    },

    /** Lista jobs com filtro opcional por status e/ou tipo. */
    list: async (filtros?: { status?: string; tipo?: JobTipo; limit?: number }): Promise<JobQueue[]> => {
      let q = supabase
        .from('job_queue')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(filtros?.limit ?? 100);
      if (filtros?.status) q = q.eq('status', filtros.status);
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as JobQueue[];
    },

    /** Retorna um job pelo id. */
    get: async (id: string): Promise<JobQueue | null> => {
      const { data, error } = await supabase
        .from('job_queue')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as JobQueue | null;
    },

    /** Reenfileira um job falhou (reset para pendente com tentativas zeradas). */
    retry: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('job_queue')
        .update({ status: 'pendente', tentativas: 0, erro: null, executar_em: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['falhou', 'cancelado']);
      if (error) throw error;
    },

    /** Cancela um job pendente. */
    cancel: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('job_queue')
        .update({ status: 'cancelado' })
        .eq('id', id)
        .eq('status', 'pendente');
      if (error) throw error;
    },
  },

  /** QW-12: Monitoramento externo — health checks e alertas proativos. */
  systemHealth: {
    /** Lista os últimos N registros de health check, opcionalmente filtrado por serviço. */
    listLogs: async (servico?: string, limit = 100): Promise<SystemHealthLog[]> => {
      let q = supabase
        .from('system_health_log')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(limit);
      if (servico) q = q.eq('servico', servico);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SystemHealthLog[];
    },

    /** Retorna o status mais recente de cada serviço via view v_system_health_atual. */
    latestByServico: async (): Promise<SystemHealthLog[]> => {
      const { data, error } = await supabase
        .from('v_system_health_atual')
        .select('*');
      if (error) throw error;
      return (data || []) as SystemHealthLog[];
    },

    /** Lista alertas, por padrão apenas os não resolvidos. */
    listAlerts: async (apenasAtivos = true): Promise<SystemAlert[]> => {
      let q = supabase
        .from('system_alerts')
        .select('*')
        .order('criado_em', { ascending: false });
      if (apenasAtivos) q = q.eq('resolvido', false);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SystemAlert[];
    },

    /** Marca um alerta como resolvido. */
    resolverAlerta: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('system_alerts')
        .update({ resolvido: true, resolvido_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    /** Dispara a Edge Function health-check manualmente. */
    triggerHealthCheck: async (): Promise<{ ok: boolean; resumo: Record<string, unknown> }> => {
      const { data, error } = await supabase.functions.invoke('health-check', {
        body: { manual: true },
      });
      if (error) throw error;
      return data as { ok: boolean; resumo: Record<string, unknown> };
    },
  },

  /** QW-10B: consulta a fila de órfãos Cloudinary (admin only). */
  cloudinaryOrfaos: {
    listar: async (clienteId?: string): Promise<Array<{
      id: string; public_id: string; url: string | null;
      origem_tabela: string; motivo: string; retention_until: string; created_at: string;
    }>> => {
      let q = supabase
        .from('cloudinary_orfaos')
        .select('id, public_id, url, origem_tabela, motivo, retention_until, created_at')
        .is('processado_em', null)
        .order('retention_until', { ascending: true });
      if (clienteId) q = q.eq('cliente_id', clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Array<{
        id: string; public_id: string; url: string | null;
        origem_tabela: string; motivo: string; retention_until: string; created_at: string;
      }>;
    },
  },

  /** QW-15 — Billing, Planos e Snapshots de uso. */
  billing: {
    /** Lista todos os planos do catálogo. */
    listPlanos: async (): Promise<Plano[]> => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data || []) as Plano[];
    },

    /** Retorna o plano contratado do cliente (com dados do plano). */
    getClientePlano: async (clienteId: string): Promise<ClientePlano | null> => {
      const { data, error } = await supabase
        .from('cliente_plano')
        .select('*, plano:planos(*)')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as ClientePlano | null;
    },

    /** Atualiza o plano de um cliente (admin plataforma). */
    updateClientePlano: async (clienteId: string, payload: Partial<Pick<ClientePlano, 'plano_id' | 'status' | 'contrato_ref' | 'data_fim' | 'observacao' | 'limites_personalizados'>>): Promise<void> => {
      const { error } = await supabase
        .from('cliente_plano')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('cliente_id', clienteId);
      if (error) throw error;
    },

    /** Resumo de billing de todos os clientes — view v_billing_resumo (admin plataforma). */
    listResumo: async (): Promise<BillingResumo[]> => {
      const { data, error } = await supabase
        .from('v_billing_resumo')
        .select('*')
        .order('cliente_nome');
      if (error) throw error;
      return (data || []) as BillingResumo[];
    },

    /** Histórico de snapshots de um cliente. */
    listSnapshots: async (clienteId: string): Promise<BillingUsageSnapshot[]> => {
      const { data, error } = await supabase
        .from('billing_usage_snapshot')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('periodo_inicio', { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []) as BillingUsageSnapshot[];
    },

    /** Snapshot mais recente de um cliente. */
    getUltimoSnapshot: async (clienteId: string): Promise<BillingUsageSnapshot | null> => {
      const { data, error } = await supabase
        .from('billing_usage_snapshot')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('periodo_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as BillingUsageSnapshot | null;
    },

    /** Ciclos de faturamento de um cliente. */
    listCiclos: async (clienteId: string): Promise<BillingCiclo[]> => {
      const { data, error } = await supabase
        .from('billing_ciclo')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('periodo_inicio', { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []) as BillingCiclo[];
    },

    /** Dispara o snapshot manual para um cliente via Edge Function. */
    triggerSnapshot: async (clienteId: string): Promise<void> => {
      const { error } = await supabase.functions.invoke('billing-snapshot', {
        body: { force_cliente_id: clienteId },
      });
      if (error) throw error;
    },
  },

  levantamentoItemEvidencias: {
    /** Lista evidências da detecção original de um item de levantamento. */
    listByItem: async (itemId: string) => {
      const { data, error } = await supabase
        .from('levantamento_item_evidencias')
        .select('id, image_url, legenda, created_at')
        .eq('levantamento_item_id', itemId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  },

  // ── Pipeline Python (processamento de voos de drone) ──────────────────────
  pipeline: {
    /** Lista execuções do pipeline com levantamento vinculado. */
    listRuns: async (clienteId: string, limit = 20) => {
      const { data, error } = await supabase
        .from('pipeline_runs')
        .select('*, levantamento:levantamentos(titulo, data_voo, total_itens)')
        .eq('cliente_id', clienteId)
        .order('iniciado_em', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    /** Retorna o run em andamento mais recente, ou null. */
    getRunAtivo: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('pipeline_runs')
        .select('*, levantamento:levantamentos(titulo, data_voo, total_itens)')
        .eq('cliente_id', clienteId)
        .eq('status', 'em_andamento')
        .order('iniciado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  },

  // ── Score Territorial de Risco ────────────────────────────────────────────
  score: {
    /** Busca o score de um imóvel específico. */
    getImovel: async (clienteId: string, imovelId: string) => {
      const { data, error } = await supabase
        .from('territorio_score')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('imovel_id', imovelId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    /** Lista imóveis com score alto/muito_alto/crítico ordenados por score desc. */
    listTopCriticos: async (clienteId: string, limit = 20) => {
      const { data, error } = await supabase
        .from('territorio_score')
        .select(`
          *,
          imovel:imoveis(logradouro, numero, bairro, quarteirao,
                         latitude, longitude, historico_recusa, prioridade_drone)
        `)
        .eq('cliente_id', clienteId)
        .in('classificacao', ['critico', 'muito_alto', 'alto'])
        .order('score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    /** Lista score agregado por bairro via view v_score_bairro. */
    listBairros: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_score_bairro')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('score_medio', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    /** Busca configuração de pesos do score para o cliente. */
    getConfig: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('score_config')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    /** Força recálculo síncrono do score de um imóvel via RPC. */
    forcarRecalculo: async (clienteId: string, imovelId: string) => {
      const { error } = await supabase.rpc('fn_calcular_score_imovel', {
        p_imovel_id: imovelId,
        p_cliente_id: clienteId,
      });
      if (error) throw error;
    },

    /** Salva configuração de pesos do score. */
    upsertConfig: async (clienteId: string, config: Record<string, unknown>) => {
      const { error } = await supabase
        .from('score_config')
        .upsert({ cliente_id: clienteId, ...config, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
  },

  // ── Central Operacional do Dia ─────────────────────────────────────────────
  central: {
    /** KPIs do dia para o gestor (view v_central_operacional — 1 row por usuário logado). */
    getKpis: async () => {
      const { data, error } = await supabase
        .from('v_central_operacional')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    /** Lista imóveis críticos/muito_alto/alto para priorização do dia. */
    listImoveisParaHoje: async (clienteId: string, limit = 30) => {
      const { data, error } = await supabase
        .from('v_imoveis_para_hoje')
        .select('*')
        .eq('cliente_id', clienteId)
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  },

  // ── Gestão de Ciclos Epidemiológicos ─────────────────────────────────────
  ciclos: {
    getCicloAtivo: async (_clienteId: string) => {
      const { data, error } = await supabase
        .from('v_ciclo_ativo')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    getProgresso: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_ciclo_progresso')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    listHistorico: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('ciclos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('ano', { ascending: false })
        .order('numero', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    abrir: async (clienteId: string, params: {
      numero: number;
      ano?: number;
      meta_cobertura_pct?: number;
      observacao?: string;
    }) => {
      const { data, error } = await supabase.rpc('abrir_ciclo', {
        p_cliente_id:         clienteId,
        p_numero:             params.numero,
        p_ano:                params.ano ?? null,
        p_meta_cobertura_pct: params.meta_cobertura_pct ?? 100,
        p_observacao:         params.observacao ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; ciclo_id: string; numero: number; ano: number };
    },

    fechar: async (clienteId: string, params: {
      numero: number;
      ano?: number;
      observacao?: string;
    }) => {
      const { data, error } = await supabase.rpc('fechar_ciclo', {
        p_cliente_id: clienteId,
        p_numero:     params.numero,
        p_ano:        params.ano ?? null,
        p_observacao: params.observacao ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; snapshot: unknown };
    },

    copiarDistribuicao: async (clienteId: string, origem: number, destino: number) => {
      const { data, error } = await supabase.rpc('copiar_distribuicao_ciclo', {
        p_cliente_id:    clienteId,
        p_ciclo_origem:  origem,
        p_ciclo_destino: destino,
      });
      if (error) throw error;
      return data as number;
    },
  },

  // ── Painel Executivo Municipal ────────────────────────────────────────────
  executivo: {
    /** KPIs estratégicos da semana atual (view v_executivo_kpis — 1 row por usuário logado). */
    getKpis: async () => {
      const { data, error } = await supabase
        .from('v_executivo_kpis')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    /** Tendência de 8 semanas (view v_executivo_tendencia). */
    getTendencia: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_executivo_tendencia')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('semana_inicio', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },

    /** Cobertura territorial por bairro (view v_executivo_cobertura). */
    getCobertura: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_executivo_cobertura')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('focos_ativos', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    /** Variação por bairro: score + tendência de focos (view v_executivo_bairros_variacao). */
    getBairrosVariacao: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_executivo_bairros_variacao')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('score_atual', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    /** Comparativo entre ciclo atual e anterior (view v_executivo_comparativo_ciclos — 1 row por usuário). */
    getComparativoCiclos: async () => {
      const { data, error } = await supabase
        .from('v_executivo_comparativo_ciclos')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  },

  // ── Eficácia de Tratamentos ───────────────────────────────────────────────
  eficacia: {
    /** Lista eficácia por tipo de depósito e uso de larvicida (view v_eficacia_tratamento). */
    listPorDeposito: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_eficacia_tratamento')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('tipo_deposito')
        .order('usou_larvicida');
      if (error) throw error;
      return data ?? [];
    },

    /** Lista focos resolvidos nos últimos N dias para análise histórica. */
    listFocosResolvidos: async (clienteId: string, diasAtras = 180) => {
      const desde = new Date();
      desde.setDate(desde.getDate() - diasAtras);
      const { data, error } = await supabase
        .from('focos_risco')
        .select(`
          id, imovel_id, regiao_id, status, confirmado_em, resolvido_em, desfecho,
          foco_anterior_id,
          imovel:imoveis(logradouro, numero, bairro, quarteirao)
        `)
        .eq('cliente_id', clienteId)
        .eq('status', 'resolvido')
        .gte('resolvido_em', desde.toISOString())
        .order('resolvido_em', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  },

  reincidencia: {
    listImoveisReincidentes: async (clienteId: string, filtros?: { padrao?: string; bairro?: string; limit?: number }) => {
      let query = supabase
        .from('v_imoveis_reincidentes')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('total_focos_historico', { ascending: false });
      if (filtros?.padrao) query = query.eq('padrao', filtros.padrao);
      if (filtros?.bairro) query = query.eq('bairro', filtros.bairro);
      if (filtros?.limit) query = query.limit(filtros.limit);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },

    listPorDeposito: async (clienteId: string, bairro?: string) => {
      let query = supabase
        .from('v_reincidencia_por_deposito')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('indice_reincidencia_pct', { ascending: false });
      if (bairro) query = query.eq('bairro', bairro);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },

    listSazonalidade: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_reincidencia_sazonalidade')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('ciclo', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },

    scoreImovel: async (clienteId: string, imovelId: string) => {
      const { data, error } = await supabase
        .rpc('fn_risco_reincidencia_imovel', { p_imovel_id: imovelId, p_cliente_id: clienteId });
      if (error) throw error;
      return data;
    },

    historicoCiclosImovel: async (clienteId: string, imovelId: string) => {
      const { data, error } = await supabase
        .from('vistorias')
        .select(`
          id, ciclo, status, acesso_realizado, data_visita,
          motivo_sem_acesso, tipo_atividade,
          agente:usuarios(nome),
          depositos:vistoria_depositos(tipo, qtd_com_focos, usou_larvicida)
        `)
        .eq('imovel_id', imovelId)
        .eq('cliente_id', clienteId)
        .is('deleted_at', null)
        .order('ciclo', { ascending: true })
        .order('data_visita', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  },

  // ── GAP P0: Reinspeções Programadas ─────────────────────────────────────────
  reinspecoes: {
    /** Busca uma reinspeção por ID com dados do foco e imóvel. */
    getById: async (reinspecaoId: string): Promise<ReinspecaoComFoco | null> => {
      const { data, error } = await supabase
        .from('reinspecoes_programadas')
        .select(`
          *,
          foco:focos_risco!foco_risco_id(
            id, status, prioridade, endereco_normalizado,
            imovel:imoveis(logradouro, bairro, numero)
          )
        `)
        .eq('id', reinspecaoId)
        .single();
      if (error) throw error;
      return data as ReinspecaoComFoco | null;
    },

    /** Lista todas as reinspeções vinculadas a um foco, ordenadas por data_prevista DESC. */
    listByFoco: async (focoRiscoId: string): Promise<ReinspecaoProgramada[]> => {
      const { data, error } = await supabase
        .from('reinspecoes_programadas')
        .select('*')
        .eq('foco_risco_id', focoRiscoId)
        .order('data_prevista', { ascending: false });
      if (error) throw error;
      return (data as ReinspecaoProgramada[]) ?? [];
    },

    /** Lista reinspeções pendentes/vencidas do agente (atribuídas a ele OU sem responsável). */
    listPendentesAgente: async (
      clienteId: string,
      agenteId: string,
    ): Promise<ReinspecaoComFoco[]> => {
      const { data, error } = await supabase
        .from('reinspecoes_programadas')
        .select(`
          *,
          responsavel:usuarios!responsavel_id(nome),
          foco:focos_risco!foco_risco_id(
            endereco_normalizado, prioridade, status,
            imovel:imoveis(logradouro, bairro)
          )
        `)
        .eq('cliente_id', clienteId)
        // C-03: inclui reinspeções sem responsável (criadas pelo trigger) para que
        // qualquer agente do cliente as veja e possa registrar o resultado.
        .or(`responsavel_id.eq.${agenteId},responsavel_id.is.null`)
        .in('status', ['pendente', 'vencida'])
        .order('data_prevista', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown[]).map((r: unknown) => {
        const row = r as Record<string, unknown>;
        const foco = row.foco as Record<string, unknown> | null;
        const imovel = foco?.imovel as Record<string, unknown> | null;
        return {
          ...(row as ReinspecaoProgramada),
          responsavel_nome: (row.responsavel as Record<string, string> | null)?.nome ?? null,
          foco_endereco: (imovel?.logradouro as string) ?? (foco?.endereco_normalizado as string) ?? null,
          foco_bairro: (imovel?.bairro as string) ?? null,
          foco_prioridade: (foco?.prioridade as string) ?? null,
          foco_status: (foco?.status as string) ?? null,
        } as ReinspecaoComFoco;
      });
    },

    /** Lista reinspeções vencidas do cliente para o supervisor. */
    listVencidasCliente: async (clienteId: string): Promise<ReinspecaoComFoco[]> => {
      const { data, error } = await supabase
        .from('reinspecoes_programadas')
        .select(`
          *,
          responsavel:usuarios!responsavel_id(nome),
          foco:focos_risco!foco_risco_id(
            endereco_normalizado, prioridade, status,
            imovel:imoveis(logradouro, bairro)
          )
        `)
        .eq('cliente_id', clienteId)
        .eq('status', 'vencida')
        .order('data_prevista', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown[]).map((r: unknown) => {
        const row = r as Record<string, unknown>;
        const foco = row.foco as Record<string, unknown> | null;
        const imovel = foco?.imovel as Record<string, unknown> | null;
        return {
          ...(row as ReinspecaoProgramada),
          responsavel_nome: (row.responsavel as Record<string, string> | null)?.nome ?? null,
          foco_endereco: (imovel?.logradouro as string) ?? (foco?.endereco_normalizado as string) ?? null,
          foco_bairro: (imovel?.bairro as string) ?? null,
          foco_prioridade: (foco?.prioridade as string) ?? null,
          foco_status: (foco?.status as string) ?? null,
        } as ReinspecaoComFoco;
      });
    },

    /** Conta reinspeções pendentes/vencidas de um agente. */
    countPendentesAgente: async (clienteId: string, agenteId: string): Promise<number> => {
      const { count, error } = await supabase
        .from('reinspecoes_programadas')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)
        .or(`responsavel_id.eq.${agenteId},responsavel_id.is.null`)
        .in('status', ['pendente', 'vencida']);
      if (error) throw error;
      return count ?? 0;
    },

    /** Cria reinspeção manual via RPC. */
    criar: async (payload: {
      focoRiscoId: string;
      tipo?: ReinspecaoTipo;
      dataPrevista: Date;
      responsavelId?: string;
      observacao?: string;
    }): Promise<{ ok: boolean; id?: string; error?: string }> => {
      const { data, error } = await supabase.rpc('rpc_criar_reinspecao_manual', {
        p_foco_risco_id:  payload.focoRiscoId,
        p_tipo:           payload.tipo ?? 'eficacia_pos_tratamento',
        p_data_prevista:  payload.dataPrevista.toISOString(),
        p_responsavel_id: payload.responsavelId ?? null,
        p_observacao:     payload.observacao ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; id?: string; error?: string };
    },

    /** Registra o resultado de uma reinspeção (executada pelo agente). */
    registrarResultado: async (payload: {
      reinspecaoId: string;
      resultado: 'resolvido' | 'persiste' | 'nao_realizado';
      observacao?: string;
      dataRealizada?: Date;
    }): Promise<{ ok: boolean; pode_resolver_foco?: boolean; foco_id?: string; error?: string }> => {
      const { data, error } = await supabase.rpc('rpc_registrar_reinspecao_resultado', {
        p_reinspecao_id:  payload.reinspecaoId,
        p_resultado:      payload.resultado,
        p_observacao:     payload.observacao ?? null,
        p_data_realizada: (payload.dataRealizada ?? new Date()).toISOString(),
      });
      if (error) throw error;
      return data as { ok: boolean; pode_resolver_foco?: boolean; foco_id?: string; error?: string };
    },

    /** Cancela uma reinspeção. */
    cancelar: async (reinspecaoId: string, motivo?: string): Promise<void> => {
      const { data, error } = await supabase.rpc('rpc_cancelar_reinspecao', {
        p_reinspecao_id:       reinspecaoId,
        p_motivo_cancelamento: motivo ?? 'Cancelado manualmente',
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Erro ao cancelar reinspeção');
    },

    /** Reagenda uma reinspeção para nova data. */
    reagendar: async (reinspecaoId: string, novaData: Date, responsavelId?: string): Promise<void> => {
      const { data, error } = await supabase.rpc('rpc_reagendar_reinspecao', {
        p_reinspecao_id:  reinspecaoId,
        p_nova_data:      novaData.toISOString(),
        p_responsavel_id: responsavelId ?? null,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Erro ao reagendar reinspeção');
    },

    /** Força marcação de vencidas (utilitário admin). */
    marcarVencidas: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('fn_marcar_reinspecoes_vencidas');
      if (error) throw error;
      return (data as number) ?? 0;
    },
  },

  /** P1-3 — Audit Log */
  auditLog: {
    list: async (clienteId: string, limit = 100): Promise<import('@/types/database').AuditLog[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as import('@/types/database').AuditLog[];
    },
  },

  /** Alertas de retorno de imóvel (agente precisa revisitar). */
  alertasRetorno: {
    listByAgente: async (clienteId: string, agenteId: string): Promise<Record<string, unknown>[]> => {
      const { data, error } = await supabase
        .from('alerta_retorno_imovel')
        .select('*, imovel:imoveis(numero, logradouro, bairro)')
        .eq('cliente_id', clienteId)
        .eq('agente_id', agenteId)
        .eq('resolvido', false)
        .order('retorno_em', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    resolver: async (alertaId: string): Promise<void> => {
      const { error } = await supabase
        .from('alerta_retorno_imovel')
        .update({ resolvido: true, resolvido_em: new Date().toISOString() })
        .eq('id', alertaId);
      if (error) throw error;
    },
  },

  /** Erros de criação de SLA (tabela de debug). */
  slaErros: {
    listByCliente: async (clienteId: string): Promise<Record<string, unknown>[]> => {
      const { data, error } = await supabase
        .from('sla_erros_criacao')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  },

  /** Histórico de atendimento local (view v_historico_atendimento_local). */
  historicoAtendimento: {
    listByClienteELocalizacao: async (
      clienteId: string,
      latitude: number,
      longitude: number,
      tolerance = 0.0001,
    ): Promise<Record<string, unknown>[]> => {
      const { data, error } = await supabase
        .from('v_historico_atendimento_local')
        .select('*')
        .eq('cliente_id', clienteId)
        .gte('latitude', latitude - tolerance)
        .lte('latitude', latitude + tolerance)
        .gte('longitude', longitude - tolerance)
        .lte('longitude', longitude + tolerance)
        .order('item_data_hora', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    listByCliente: async (clienteId: string): Promise<Record<string, unknown>[]> => {
      const { data, error } = await supabase
        .from('v_historico_atendimento_local')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('item_data_hora', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  },

  /** Configuração de SLA por cliente (tabela sla_config). */
  slaConfig: {
    getByCliente: async (clienteId: string): Promise<{ id: string; config: Record<string, unknown> } | null> => {
      const { data, error } = await supabase
        .from('sla_config')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; config: Record<string, unknown> } | null;
    },
    upsert: async (clienteId: string, config: Record<string, unknown>, existingId?: string | null): Promise<void> => {
      if (existingId) {
        const { error } = await supabase
          .from('sla_config')
          .update({ config, updated_at: new Date().toISOString() })
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sla_config')
          .insert({ cliente_id: clienteId, config });
        if (error) throw error;
      }
    },
  },

  /** Auditoria de configuração de SLA (tabela sla_config_audit). */
  slaConfigAudit: {
    listByCliente: async (clienteId: string): Promise<Record<string, unknown>[]> => {
      const { data, error } = await supabase
        .from('sla_config_audit')
        .select('*, usuario:usuarios!sla_config_audit_changed_by_fkey(nome, email)')
        .eq('cliente_id', clienteId)
        .order('changed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  },

  /** Política de risco (tabela sentinela_risk_policy) — criação/atualização do cabeçalho. */
  riskPolicyHeader: {
    create: async (clienteId: string, payload: { name: string; version: string; is_active: boolean }): Promise<{ id: string }> => {
      const { data, error } = await supabase
        .from('sentinela_risk_policy')
        .insert({ cliente_id: clienteId, ...payload })
        .select('id')
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    update: async (policyId: string, payload: { name: string; version: string; is_active: boolean }): Promise<void> => {
      const { error } = await supabase
        .from('sentinela_risk_policy')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', policyId);
      if (error) throw error;
    },
  },

  /** Operações SLA — upsert+concluir para ConcluirSlaDialog. */
  operacoesSla: {
    ensureAndConcluir: async (params: {
      clienteId: string;
      itemId: string;
      usuarioId: string;
      prioridade: string;
      observacao: string | null;
    }): Promise<string | null> => {
      const { clienteId, itemId, usuarioId, prioridade, observacao } = params;
      const { data: existing } = await supabase
        .from('operacoes')
        .select('id, status')
        .eq('cliente_id', clienteId)
        .eq('item_operacional_id', itemId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('operacoes')
          .update({
            status: 'concluido',
            observacao: observacao || null,
            responsavel_id: usuarioId,
            concluido_em: new Date().toISOString(),
          })
          .eq('id', (existing as { id: string }).id);
        if (error) throw error;
        return (existing as { id: string }).id;
      }

      const { data: inserted, error } = await supabase
        .from('operacoes')
        .insert({
          cliente_id: clienteId,
          item_operacional_id: itemId,
          tipo_vinculo: 'operacional',
          status: 'concluido',
          prioridade,
          observacao: observacao || null,
          responsavel_id: usuarioId,
          concluido_em: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      return (inserted as { id: string } | null)?.id ?? null;
    },
    addEvidencia: async (operacaoId: string, imageUrl: string, legenda: string | null): Promise<void> => {
      const { error } = await supabase
        .from('operacao_evidencias')
        .insert({ operacao_id: operacaoId, image_url: imageUrl, legenda });
      if (error) throw error;
    },
  },

  /** SLA Inteligente — leitura das colunas fase/tempo/status da v_focos_risco_ativos (Fase A). */
  slaInteligente: {
    /** Todos os focos ativos com dados de SLA inteligente, por criticidade desc. */
    listByCliente: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_focos_risco_ativos')
        .select('id, cliente_id, status, prioridade, logradouro, bairro, suspeita_em, responsavel_nome')
        .eq('cliente_id', clienteId)
        .order('suspeita_em', { ascending: false, nullsFirst: false });
      if (error) return []; // view pode não existir ou colunas SLA ausentes no banco antigo
      return ((data || []) as Array<Record<string, unknown>>).map(r => ({
        ...r,
        fase_sla: null,
        tempo_em_estado_atual_min: null,
        prazo_fase_min: null,
        status_sla_inteligente: calcSlaInteligente(
          r.status as string,
          null,
          null,
        ),
      })) as Array<{
        id: string;
        cliente_id: string;
        status: string;
        prioridade: string;
        logradouro: string | null;
        bairro: string | null;
        fase_sla: string | null;
        tempo_em_estado_atual_min: number | null;
        prazo_fase_min: number | null;
        status_sla_inteligente: string | null;
        suspeita_em: string;
        responsavel_nome: string | null;
      }>;
    },

    /** Apenas focos em status 'critico' ou 'vencido'. */
    listCriticos: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_focos_risco_ativos')
        .select('id, cliente_id, status, prioridade, logradouro, bairro, suspeita_em, responsavel_nome')
        .eq('cliente_id', clienteId)
        .order('suspeita_em', { ascending: false, nullsFirst: false });
      if (error) return []; // view pode não existir ou colunas SLA ausentes no banco antigo
      return ((data || []) as Array<Record<string, unknown>>)
        .map(r => ({
          ...r,
          fase_sla: null,
          tempo_em_estado_atual_min: null,
          prazo_fase_min: null,
          status_sla_inteligente: calcSlaInteligente(r.status as string, null, null),
        }))
        .filter(r => r.status_sla_inteligente === 'critico' || r.status_sla_inteligente === 'vencido') as Array<{
        id: string;
        cliente_id: string;
        status: string;
        prioridade: string;
        logradouro: string | null;
        bairro: string | null;
        fase_sla: string | null;
        tempo_em_estado_atual_min: number | null;
        prazo_fase_min: number | null;
        status_sla_inteligente: string | null;
        suspeita_em: string;
        responsavel_nome: string | null;
      }>;
    },

    /** SLA inteligente de um foco específico (via v_focos_risco_ativos). */
    getByFocoId: async (focoId: string) => {
      const { data, error } = await supabase
        .from('v_focos_risco_ativos')
        .select('id, status')
        .eq('id', focoId)
        .maybeSingle();
      if (error) return null; // view pode não existir ou colunas SLA ausentes no banco antigo
      if (!data) return null;
      const r = data as Record<string, unknown>;
      return {
        ...r,
        fase_sla: null,
        tempo_em_estado_atual_min: null,
        prazo_fase_min: null,
        status_sla_inteligente: calcSlaInteligente(r.status as string, null, null),
      } as {
        id: string;
        status: string;
        fase_sla: string | null;
        tempo_em_estado_atual_min: number | null;
        prazo_fase_min: number | null;
        status_sla_inteligente: string | null;
      };
    },
  },

  /** Edge Function: identify-larva (identificação de larvas por IA). */
  identifyLarva: {
    invoke: async (params: {
      image_base64: string;
      deposito_tipo: string;
      vistoria_id: string | null;
    }): Promise<{ identified: boolean; confidence: number; classe?: string; image_url?: string }> => {
      const { data, error } = await supabase.functions.invoke('identify-larva', { body: params });
      if (error) throw new Error(error.message);
      return data as { identified: boolean; confidence: number; classe?: string; image_url?: string };
    },
  },

  // ── P5: Analista Regional ────────────────────────────────────────────────

  /** Agrupamentos regionais (admin only). */
  agrupamentos: {
    list: async () => {
      const { data, error } = await supabase
        .from('agrupamento_regional')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },

    create: async (payload: { nome: string; tipo: string; uf: string | null }) => {
      const { data, error } = await supabase
        .from('agrupamento_regional')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    update: async (id: string, payload: Partial<{ nome: string; tipo: string; uf: string | null; ativo: boolean }>) => {
      const { error } = await supabase
        .from('agrupamento_regional')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    listClientes: async (agrupamentoId: string) => {
      const { data, error } = await supabase
        .from('agrupamento_cliente')
        .select('cliente_id, adicionado_em, clientes(id, nome, cidade, uf)')
        .eq('agrupamento_id', agrupamentoId);
      if (error) throw error;
      return data ?? [];
    },

    addCliente: async (agrupamentoId: string, clienteId: string) => {
      const { error } = await supabase
        .from('agrupamento_cliente')
        .insert({ agrupamento_id: agrupamentoId, cliente_id: clienteId });
      if (error) throw error;
    },

    removeCliente: async (agrupamentoId: string, clienteId: string) => {
      const { error } = await supabase
        .from('agrupamento_cliente')
        .delete()
        .eq('agrupamento_id', agrupamentoId)
        .eq('cliente_id', clienteId);
      if (error) throw error;
    },
  },

  // ── P7.7 — Observabilidade Operacional do Piloto ───────────────────────────
  piloto: {
    /** Funil operacional do dia: entradas → triagem → despacho → campo → resolução. */
    getFunilHoje: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_piloto_funil_hoje')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) return null; // view pode não existir no banco antigo
      return data;
    },

    /** Despachos por supervisor nos últimos 7 dias. */
    getDespachosSupervisor: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_piloto_despachos_supervisor')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('despachados_7d', { ascending: false });
      if (error) return []; // view pode não existir no banco antigo
      return data ?? [];
    },

    /** Produtividade dos agentes em campo (focos atribuídos). */
    getProdAgentes: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_piloto_prod_agentes')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('atribuidos_ativos', { ascending: false });
      if (error) return []; // view pode não existir no banco antigo
      return data ?? [];
    },
  },

  /** Auditoria operacional do canal cidadão (uso restrito: admin/supervisor). */
  canalCidadao: {
    /** Métricas agregadas de volume e deduplicação por cliente. */
    stats: async (clienteId: string): Promise<{
      total: number;
      ultimas_24h: number;
      ultimos_7d: number;
      ultimos_30d: number;
      com_foco_vinculado: number;
      resolvidos: number;
      em_aberto: number;
    } | null> => {
      const { data, error } = await supabase
        .from('v_canal_cidadao_stats')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) return null; // view pode não existir no banco antigo
      return data as typeof data & { total: number } | null;
    },

    /** Auditoria de eventos do canal cidadão (RATE_LIMIT, DEDUPLICADO, ACEITO) — admin/supervisor apenas. */
    eventosAudit: async (clienteId: string): Promise<Array<{
      cliente_id: string;
      motivo: string;
      total: number;
      ultima_hora: number;
      ultimas_24h: number;
      ultimos_7d: number;
      ultimos_30d: number;
      ultimo_evento: string;
    }>> => {
      const { data, error } = await supabase
        .from('v_canal_cidadao_eventos_audit')
        .select('*')
        .eq('cliente_id', clienteId);
      if (error) return []; // view pode não existir no banco antigo
      return (data || []) as Array<{
        cliente_id: string;
        motivo: string;
        total: number;
        ultima_hora: number;
        ultimas_24h: number;
        ultimos_7d: number;
        ultimos_30d: number;
        ultimo_evento: string;
      }>;
    },
  },

  // ── Dashboard Analítico Estratégico (P8.2) ────────────────────────────────
  dashboardAnalitico: {
    /** KPIs macro por cliente (v_dashboard_analitico_resumo — 1 row). */
    getResumo: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_dashboard_analitico_resumo')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      if (error) return null; // view pode não existir no banco antigo
      return data;
    },

    /** Risco agregado por bairro (v_dashboard_analitico_risco_territorial). */
    getRiscoTerritorial: async (clienteId: string, bairro?: string) => {
      let q = supabase
        .from('v_dashboard_analitico_risco_territorial')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('criticos_count', { ascending: false });
      if (bairro) q = q.eq('bairro', bairro);
      const { data, error } = await q;
      if (error) return []; // view pode não existir no banco antigo
      return data ?? [];
    },

    /** Distribuição de vulnerabilidade_domiciliar por bairro. */
    getVulnerabilidade: async (clienteId: string, bairro?: string) => {
      let q = supabase
        .from('v_dashboard_analitico_vulnerabilidade')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('total', { ascending: false });
      if (bairro) q = q.eq('bairro', bairro);
      const { data, error } = await q;
      if (error) return []; // view pode não existir no banco antigo
      return data ?? [];
    },

    /** Distribuição de alerta_saude por bairro. */
    getAlertaSaude: async (clienteId: string, bairro?: string) => {
      let q = supabase
        .from('v_dashboard_analitico_alerta_saude')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('total', { ascending: false });
      if (bairro) q = q.eq('bairro', bairro);
      const { data, error } = await q;
      if (error) return []; // view pode não existir no banco antigo
      return data ?? [];
    },

    /** Distribuição de resultado_operacional por bairro. */
    getResultadoOperacional: async (clienteId: string, bairro?: string) => {
      let q = supabase
        .from('v_dashboard_analitico_resultado_operacional')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('total', { ascending: false });
      if (bairro) q = q.eq('bairro', bairro);
      const { data, error } = await q;
      if (error) return []; // view pode não existir no banco antigo
      return data ?? [];
    },

    /** Imóveis P1/P2 com todas as dimensões analíticas. */
    getImoveisCriticos: async (clienteId: string, bairro?: string, prioridade?: string) => {
      let q = supabase
        .from('v_dashboard_analitico_imoveis_criticos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('dimensoes_criticas_count', { ascending: false })
        .order('data_visita', { ascending: false });
      if (bairro) q = q.eq('bairro', bairro);
      if (prioridade) q = q.eq('prioridade_final', prioridade);
      const { data, error } = await q;
      if (error) return []; // view pode não existir no banco antigo
      return data ?? [];
    },

    /** Lista de bairros distintos com vistorias consolidadas (para filtro). */
    getBairros: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('v_dashboard_analitico_risco_territorial')
        .select('bairro')
        .eq('cliente_id', clienteId)
        .order('bairro');
      if (error) return []; // view pode não existir no banco antigo
      return (data ?? []).map((r: { bairro: string }) => r.bairro);
    },

    /**
     * Gera payload completo do relatório executivo analítico (P8.3).
     * Chama rpc_gerar_relatorio_analitico — SECURITY INVOKER, RLS aplicado.
     */
    relatorio: async (clienteId: string, periodoInicio: string, periodoFim: string) => {
      const { data, error } = await supabase.rpc('rpc_gerar_relatorio_analitico', {
        p_cliente_id:    clienteId,
        p_periodo_inicio: periodoInicio,
        p_periodo_fim:    periodoFim,
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },

    /** Salva relatório gerado no histórico (relatorios_gerados). */
    salvarRelatorio: async (params: {
      clienteId: string;
      periodoInicio: string;
      periodoFim: string;
      payload: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from('relatorios_gerados').insert({
        cliente_id:     params.clienteId,
        periodo_inicio: params.periodoInicio,
        periodo_fim:    params.periodoFim,
        payload:        params.payload,
      });
      if (error) throw error;
    },

    /** Lista histórico de relatórios gerados para o cliente. */
    listarRelatorios: async (clienteId: string) => {
      const { data, error } = await supabase
        .from('relatorios_gerados')
        .select('id, periodo_inicio, periodo_fim, created_at')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  },
};
