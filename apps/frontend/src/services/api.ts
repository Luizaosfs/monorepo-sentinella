/**
 * api.ts — Adapter: HTTP (NestJS) para módulos migrados, Supabase para demais.
 *
 * REGRA: não alterar assinaturas públicas. Apenas a implementação interna muda.
 *
 * Módulos HTTP (NestJS): focosRisco, sla, reinspecoes, vistorias, operacoes, operacoesSla,
 *   levantamentos, itens, imoveis, clientes, planejamentos, ciclos, usuarios (parcial),
 *   planoAcaoCatalogo, resumosDiarios (parcial), scoreSurto,
 *   slaFeriados, slaConfig, slaConfigRegiao, slaErros,
 *   drones, voos, pipeline, condicoesVoo, yoloFeedback,
 *   casosNotificados (parcial), unidadesSaude, notificacoesESUS (parcial),
 *   pushSubscriptions (parcial), notificacaoFormal,
 *   pluvio (parcial), pluvioOperacional, pluvioRisco,
 *   billing (parcial), quotas,
 *   quarteiroes, distribuicaoQuarteirao (parcial),
 *   systemHealth (parcial),
 *   importLog (parcial), cloudinary
 * Módulos Supabase:      todos os demais (via api-supabase.ts + @fallback explícito)
 */

import '@/lib/api-client-config';
import { http } from '@sentinella/api-client';
import { logFallback } from '@/lib/fallbackLogger';
import { api as _sb } from './api-supabase';

/** Monta query string, ignorando undefined/null. Arrays → múltiplos params. */
function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((i) => p.append(k, String(i)));
    else if (v instanceof Date) p.append(k, v.toISOString());
    else p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Aliases de tipo para tornar as assinaturas legíveis
type Await<T> = T extends Promise<infer U> ? U : T;
type Ret<T extends (...args: never[]) => unknown> = Await<ReturnType<T>>;

/**
 * Converte recursivamente chaves snake_case → camelCase.
 * Usado para adaptar payloads do frontend (Supabase snake_case) para o backend NestJS (camelCase).
 */
function deepToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepToCamel);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      result[key] = deepToCamel(v);
    }
    return result;
  }
  return obj;
}

/**
 * Converte recursivamente chaves camelCase → snake_case.
 * Usado para adaptar respostas do backend NestJS (camelCase) para os tipos do frontend (snake_case).
 */
function deepToSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepToSnake);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = k.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
      result[key] = deepToSnake(v);
    }
    return result;
  }
  return obj;
}

export const api = {
  // ── Módulos Supabase (não migrados) ────────────────────────────────────────
  ..._sb,

  // ── focosRisco — HTTP (NestJS) ─────────────────────────────────────────────
  focosRisco: {
    /** Lista focos paginados com filtros (page, pageSize, status, prioridade…). */
    list: async (
      clienteId: string,
      filtros?: Parameters<typeof _sb.focosRisco.list>[1],
    ): Promise<Ret<typeof _sb.focosRisco.list>> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await http.get(`/focos-risco${qs({ clienteId, ...filtros })}`);
      // Backend paginado retorna { items, pagination } camelCase — adaptar para shape Supabase { data, count } snake_case
      if (raw && 'items' in raw) {
        return { data: deepToSnake(raw.items), count: raw.pagination?.count ?? raw.items.length, error: null } as any;
      }
      return deepToSnake(raw);
    },

    /** Contagens agregadas para fila de triagem (mesmos filtros, sem paginação). */
    contagemTriagemFila: async (
      clienteId: string,
      filtros?: Parameters<typeof _sb.focosRisco.contagemTriagemFila>[1],
    ): Promise<Ret<typeof _sb.focosRisco.contagemTriagemFila>> => {
      try {
        return await http.get(`/focos-risco/contagem-triagem${qs({ clienteId, ...filtros })}`);
      } catch (err) {
        logFallback('focosRisco', 'contagemTriagemFila', err, '/focos-risco/contagem-triagem');
        return _sb.focosRisco.contagemTriagemFila(clienteId, filtros);
      }
    },

    /** Contagem de focos agrupados por status (para KPI cards). */
    contagemPorStatus: async (clienteId: string): Promise<Record<string, number>> => {
      try {
        return await http.get(`/focos-risco/contagem-por-status${qs({ clienteId })}`);
      } catch (err) {
        logFallback('focosRisco', 'contagemPorStatus', err, '/focos-risco/contagem-por-status');
        return _sb.focosRisco.contagemPorStatus(clienteId);
      }
    },

    /** Foco ativo por ID (view v_focos_risco_ativos). Fallback Supabase: shape estendido. */
    getAtivoById: async (id: string): Promise<Ret<typeof _sb.focosRisco.getAtivoById>> => {
      try {
        return deepToSnake(await http.get(`/focos-risco/${id}/ativo`)) as any;
      } catch (err) {
        logFallback('focosRisco', 'getAtivoById', err, `/focos-risco/${id}/ativo`);
        return _sb.focosRisco.getAtivoById(id);
      }
    },

    /** Foco por ID incluindo terminais (v_focos_risco_todos). */
    getPorId: async (id: string): Promise<Ret<typeof _sb.focosRisco.getPorId>> =>
      deepToSnake(await http.get(`/focos-risco/${id}`)) as any,

    /** Foco da tabela base por ID. */
    getById: async (id: string): Promise<Ret<typeof _sb.focosRisco.getById>> =>
      deepToSnake(await http.get(`/focos-risco/${id}`)) as any,

    /** Foco com histórico de transições. Fallback Supabase: shape { foco, historico[] }. */
    get: async (id: string): Promise<Ret<typeof _sb.focosRisco.get>> => {
      try {
        return await http.get(`/focos-risco/${id}/detalhes`);
      } catch (err) {
        logFallback('focosRisco', 'get', err, `/focos-risco/${id}/detalhes`);
        return _sb.focosRisco.get(id);
      }
    },

    /** Histórico de transições de um foco, ordem cronológica. */
    historico: async (focoId: string): Promise<Ret<typeof _sb.focosRisco.historico>> => {
      try {
        return deepToSnake(await http.get(`/focos-risco/${focoId}/historico`)) as any;
      } catch (err) {
        logFallback('focosRisco', 'historico', err, `/focos-risco/${focoId}/historico`);
        return _sb.focosRisco.historico(focoId);
      }
    },

    /** Timeline unificada (estados + vistorias + SLA + casos). Fallback Supabase: v_foco_risco_timeline. */
    timeline: async (focoId: string): Promise<Ret<typeof _sb.focosRisco.timeline>> => {
      try {
        return await http.get(`/focos-risco/${focoId}/timeline`);
      } catch (err) {
        logFallback('focosRisco', 'timeline', err, `/focos-risco/${focoId}/timeline`);
        return _sb.focosRisco.timeline(focoId);
      }
    },

    /** Cria foco manualmente (origem_tipo='manual'). */
    criar: (
      payload: Parameters<typeof _sb.focosRisco.criar>[0],
    ): Promise<Ret<typeof _sb.focosRisco.criar>> =>
      http.post('/focos-risco', payload),

    /** Transiciona estado via backend (state machine validada no UseCase). */
    transicionar: (
      focoId: string,
      statusNovo: Parameters<typeof _sb.focosRisco.transicionar>[1],
      motivo?: string,
      responsavelId?: string,
    ): Promise<Ret<typeof _sb.focosRisco.transicionar>> =>
      http.post(`/focos-risco/${focoId}/transicionar`, { statusNovo, motivo, responsavelId }),

    /** Distribui foco a um agente (em_triagem → aguarda_inspecao ou reatribuição). */
    atribuirAgente: (focoId: string, agenteId: string, motivo?: string): Promise<void> =>
      http.patch(`/focos-risco/${focoId}/atribuir-agente`, { agenteId, motivo }),

    /** Distribui múltiplos focos a um agente em lote. */
    atribuirAgenteLote: (
      focoIds: string[],
      agenteId: string,
      motivo?: string,
    ): Promise<{ atribuidos: number; ignorados: number }> =>
      http.post('/focos-risco/atribuir-agente-lote', { focoIds, agenteId, motivo }),

    /** Agrupamento territorial. Fallback Supabase: v_focos_risco_agrupados (shape complexo). */
    agrupados: async (clienteId: string): Promise<Ret<typeof _sb.focosRisco.agrupados>> => {
      try {
        return await http.get(`/focos-risco/agrupados${qs({ clienteId })}`);
      } catch (err) {
        logFallback('focosRisco', 'agrupados', err, '/focos-risco/agrupados');
        return _sb.focosRisco.agrupados(clienteId);
      }
    },

    /** Drill-down de grupo: focos por lista de IDs. Fallback Supabase: shape FocoRiscoAtivo estendido. */
    listByIds: async (ids: string[]): Promise<Ret<typeof _sb.focosRisco.listByIds>> => {
      try {
        return await http.get(`/focos-risco/by-ids${qs({ ids })}`);
      } catch (err) {
        logFallback('focosRisco', 'listByIds', err, '/focos-risco/by-ids');
        return _sb.focosRisco.listByIds(ids);
      }
    },

    /** Altera classificação inicial (registra no historico). */
    atualizarClassificacao: (
      focoId: string,
      classificacao: Parameters<typeof _sb.focosRisco.atualizarClassificacao>[1],
    ): Promise<Ret<typeof _sb.focosRisco.atualizarClassificacao>> =>
      http.patch(`/focos-risco/${focoId}/classificacao`, { classificacao }),

    /** Atualiza metadados não-status (responsavel_id, desfecho). */
    update: async (
      id: string,
      payload: Parameters<typeof _sb.focosRisco.update>[1],
    ): Promise<void> => {
      try {
        await http.patch(`/focos-risco/${id}`, payload);
      } catch (err) {
        logFallback('focosRisco', 'update', err, `/focos-risco/${id}`);
        return _sb.focosRisco.update(id, payload);
      }
    },

    /** Vincula imóvel a foco (não é transição de status). */
    vincularImovel: async (focoId: string, imovelId: string): Promise<void> => {
      try {
        await http.patch(`/focos-risco/${focoId}`, { imovel_id: imovelId });
      } catch (err) {
        logFallback('focosRisco', 'vincularImovel', err, `/focos-risco/${focoId}`);
        return _sb.focosRisco.vincularImovel(focoId, imovelId);
      }
    },

    // Métodos ainda via Supabase (views analíticas/RPCs sem endpoint NestJS)
    analytics: _sb.focosRisco.analytics.bind(_sb.focosRisco),
    resumoRegional: _sb.focosRisco.resumoRegional.bind(_sb.focosRisco),
    byLevantamentoItem: _sb.focosRisco.byLevantamentoItem.bind(_sb.focosRisco),
    listByImovel: _sb.focosRisco.listByImovel.bind(_sb.focosRisco),
  },

  // ── sla — HTTP (NestJS) ────────────────────────────────────────────────────
  sla: {
    /** Lista todos os SLAs do cliente (pluvio + levantamento). */
    listByCliente: (clienteId: string): Promise<Ret<typeof _sb.sla.listByCliente>> =>
      http.get(`/sla${qs({ clienteId })}`),

    /** Lista SLAs para o painel com join de operador. */
    listForPanel: (clienteId: string, operadorId?: string): Promise<Ret<typeof _sb.sla.listForPanel>> =>
      http.get(`/sla/painel${qs({ clienteId, operadorId })}`),

    /** Avança status operacional (pendente → em_atendimento, etc.). */
    updateStatus: (
      slaId: string,
      updates: Parameters<typeof _sb.sla.updateStatus>[1],
    ): Promise<void> =>
      http.patch(`/sla/${slaId}/status`, updates),

    /** Reabre SLA concluído (recalcula prazo_final a partir de now()). */
    reabrir: (slaId: string): Promise<void> =>
      http.post(`/sla/${slaId}/reabrir`, {}),

    /** Conta SLAs vencidos/pendentes do cliente. */
    verificarVencidos: (clienteId: string): Promise<number> =>
      http.get(`/sla/pendentes/count${qs({ clienteId })}`),

    /** Escala prioridade de um SLA (P3→P2→P1). */
    escalar: (slaId: string): Promise<Ret<typeof _sb.sla.escalar>> =>
      http.post(`/sla/${slaId}/escalar`, {}),

    /** Conta SLAs pendentes do cliente (alias de verificarVencidos). */
    pendingCount: (clienteId: string): Promise<number> =>
      http.get(`/sla/pendentes/count${qs({ clienteId })}`),

    /** Conclui SLA manualmente. */
    concluir: (slaId: string): Promise<void> =>
      http.post(`/sla/${slaId}/concluir`, {}),

    /** Atribui operador responsável pelo SLA. */
    atribuir: (slaId: string, operadorId: string): Promise<void> =>
      http.patch(`/sla/${slaId}/atribuir`, { operadorId }),

    /** Erros de criação de SLA do cliente. */
    errosCriacao: async (clienteId: string): Promise<Ret<typeof _sb.sla.errosCriacao>> => {
      try {
        const raw = await http.get(`/sla/erros${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.sla.errosCriacao>;
      } catch (err) {
        logFallback('sla', 'errosCriacao', err, '/sla/erros');
        return _sb.sla.errosCriacao(clienteId);
      }
    },
  },

  // ── reinspecoes — HTTP (NestJS) ────────────────────────────────────────────
  reinspecoes: {
    /** Busca reinspeção por ID com dados do foco e imóvel. */
    getById: (reinspecaoId: string): Promise<Ret<typeof _sb.reinspecoes.getById>> =>
      http.get(`/reinspecoes/${reinspecaoId}`),

    /** Lista reinspeções de um foco, ordem data_prevista DESC. */
    listByFoco: (focoRiscoId: string): Promise<Ret<typeof _sb.reinspecoes.listByFoco>> =>
      http.get(`/reinspecoes${qs({ focoRiscoId })}`),

    /** Lista reinspeções pendentes/vencidas do agente (ou sem responsável). */
    listPendentesAgente: (
      clienteId: string,
      agenteId: string,
    ): Promise<Ret<typeof _sb.reinspecoes.listPendentesAgente>> =>
      http.get(`/reinspecoes${qs({ clienteId, agenteId, status: ['pendente', 'vencida'] })}`),

    /** Lista reinspeções vencidas do cliente (supervisor). */
    listVencidasCliente: (clienteId: string): Promise<Ret<typeof _sb.reinspecoes.listVencidasCliente>> =>
      http.get(`/reinspecoes${qs({ clienteId, status: 'vencida' })}`),

    /** Conta reinspeções pendentes/vencidas de um agente. */
    countPendentesAgente: async (clienteId: string, agenteId: string): Promise<number> => {
      try {
        return await http.get(`/reinspecoes/count${qs({ clienteId, agenteId })}`);
      } catch (err) {
        logFallback('reinspecoes', 'countPendentesAgente', err, '/reinspecoes/count');
        return _sb.reinspecoes.countPendentesAgente(clienteId, agenteId);
      }
    },

    /** Cria reinspeção manual. */
    criar: (
      payload: Parameters<typeof _sb.reinspecoes.criar>[0],
    ): Promise<Ret<typeof _sb.reinspecoes.criar>> =>
      http.post('/reinspecoes', payload),

    /** Registra resultado de uma reinspeção (executada pelo agente). */
    registrarResultado: (
      payload: Parameters<typeof _sb.reinspecoes.registrarResultado>[0],
    ): Promise<Ret<typeof _sb.reinspecoes.registrarResultado>> =>
      http.patch(`/reinspecoes/${payload.reinspecaoId}/resultado`, payload),

    /** Cancela uma reinspeção. */
    cancelar: (reinspecaoId: string, motivo?: string): Promise<void> =>
      http.patch(`/reinspecoes/${reinspecaoId}/cancelar`, { motivo }),

    /** Reagenda para nova data. */
    reagendar: (
      reinspecaoId: string,
      novaData: Date,
      responsavelId?: string,
    ): Promise<void> =>
      http.patch(`/reinspecoes/${reinspecaoId}/reagendar`, {
        novaData: novaData.toISOString(),
        responsavelId,
      }),

    /** Marca reinspeções vencidas (admin job). */
    marcarVencidas: async (): Promise<void> => {
      try { await http.post('/reinspecoes/marcar-vencidas', {}); }
      catch { return _sb.reinspecoes.marcarVencidas(); }
    },
  },

  // ── vistorias — HTTP (NestJS) + fallback Supabase ─────────────────────────
  vistorias: {
    /** Lista vistorias de um agente, opcionalmente filtradas por ciclo. */
    listByAgente: async (
      clienteId: string,
      agenteId: string,
      ciclo?: number,
    ): Promise<Ret<typeof _sb.vistorias.listByAgente>> => {
      try {
        return await http.get(`/vistorias${qs({ clienteId, agenteId, ciclo })}`);
      } catch {
        return _sb.vistorias.listByAgente(clienteId, agenteId, ciclo);
      }
    },

    /** Lista vistorias de um imóvel. */
    listByImovel: async (
      imovelId: string,
      clienteId: string,
    ): Promise<Ret<typeof _sb.vistorias.listByImovel>> => {
      try {
        return await http.get(`/vistorias${qs({ imovelId, clienteId })}`);
      } catch {
        return _sb.vistorias.listByImovel(imovelId, clienteId);
      }
    },

    /** Cria vistoria básica. Payload snake_case convertido para camelCase. */
    create: async (
      payload: Parameters<typeof _sb.vistorias.create>[0],
    ): Promise<Ret<typeof _sb.vistorias.create>> => {
      try {
        return await http.post('/vistorias', deepToCamel(payload) as Record<string, unknown>);
      } catch {
        return _sb.vistorias.create(payload);
      }
    },

    /** Atualiza status de uma vistoria. */
    updateStatus: async (
      id: string,
      status: Parameters<typeof _sb.vistorias.updateStatus>[1],
    ): Promise<void> => {
      try {
        return await http.put(`/vistorias/${id}`, { status });
      } catch {
        return _sb.vistorias.updateStatus(id, status);
      }
    },

    /**
     * Cria vistoria completa (com depósitos, sintomas, riscos, calhas) em uma transação.
     * Payload snake_case convertido para camelCase. Retorna o UUID da vistoria criada.
     */
    createCompleta: async (payload: Record<string, unknown>): Promise<string> => {
      try {
        const result = await http.post<{ id: string }>(
          '/vistorias/completa',
          deepToCamel(payload) as Record<string, unknown>,
        );
        return result.id;
      } catch {
        return _sb.vistorias.createCompleta(payload);
      }
    },

    /** Persiste public_ids do Cloudinary após createCompleta. */
    atualizarPublicIds: async (
      vistoriaId: string,
      ids: Parameters<typeof _sb.vistorias.atualizarPublicIds>[1],
    ): Promise<void> => {
      try {
        return await http.put(`/vistorias/${vistoriaId}`, deepToCamel(ids) as Record<string, unknown>);
      } catch {
        return _sb.vistorias.atualizarPublicIds(vistoriaId, ids);
      }
    },

    /** Marca pendências de evidências perdidas no modo offline. */
    marcarPendencias: async (
      vistoriaId: string,
      pendencias: Parameters<typeof _sb.vistorias.marcarPendencias>[1],
    ): Promise<void> => {
      try {
        return await http.put(`/vistorias/${vistoriaId}`, deepToCamel(pendencias) as Record<string, unknown>);
      } catch {
        return _sb.vistorias.marcarPendencias(vistoriaId, pendencias);
      }
    },

    /** Registra vistoria sem acesso ao imóvel. */
    registrarSemAcesso: async (
      vistoriaId: string,
      payload: Parameters<typeof _sb.vistorias.registrarSemAcesso>[1],
    ): Promise<void> => {
      try {
        return await http.put(`/vistorias/${vistoriaId}`, deepToCamel(payload) as Record<string, unknown>);
      } catch {
        return _sb.vistorias.registrarSemAcesso(vistoriaId, payload);
      }
    },

    // ── Fallback Supabase — sem endpoint NestJS equivalente ────────────────
    /** @fallback Depósito individual: sem endpoint NestJS; coberto por createCompleta. */
    addDeposito: _sb.vistorias.addDeposito.bind(_sb.vistorias),
    /** @fallback Sintomas individuais: sem endpoint NestJS. */
    addSintomas: _sb.vistorias.addSintomas.bind(_sb.vistorias),
    /** @fallback Riscos individuais: sem endpoint NestJS. */
    addRiscos: _sb.vistorias.addRiscos.bind(_sb.vistorias),
    /** @fallback RPC resumo_agente_ciclo: sem endpoint NestJS. */
    getResumoAgente: _sb.vistorias.getResumoAgente.bind(_sb.vistorias),
    /** @fallback RPC rpc_comparativo_agentes: sem endpoint NestJS. */
    comparativoAgentes: _sb.vistorias.comparativoAgentes.bind(_sb.vistorias),
    /** @fallback Filtros específicos (alertaSaude, riscoVetorial) fora do schema do backend. */
    listConsolidadas: _sb.vistorias.listConsolidadas.bind(_sb.vistorias),
  },

  // ── operacoes — HTTP parcial + fallback Supabase ──────────────────────────
  operacoes: {
    /**
     * Stats por status do cliente via GET /operacoes/stats.
     * Backend retorna { byStatus: Record<string,number> }; fallback se shape diferente.
     */
    statsByCliente: async (clienteId: string): Promise<Ret<typeof _sb.operacoes.statsByCliente>> => {
      try {
        const raw = await http.get(`/operacoes/stats${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.operacoes.statsByCliente>;
      } catch { return _sb.operacoes.statsByCliente(clienteId); }
    },

    /**
     * Lista operações de um foco via GET /operacoes?focoRiscoId.
     * Fallback se join evidências ausente.
     */
    listByFoco: async (focoRiscoId: string): Promise<Ret<typeof _sb.operacoes.listByFoco>> => {
      try {
        const raw = await http.get(`/operacoes${qs({ focoRiscoId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.operacoes.listByFoco>;
      } catch { return _sb.operacoes.listByFoco(focoRiscoId); }
    },

    /**
     * @fallback vinculo_nome resolvido via 3 joins no Supabase; backend não retorna esse campo.
     * Mantido em Supabase.
     */
    listarComVinculos: _sb.operacoes.listarComVinculos.bind(_sb.operacoes),

    /**
     * @fallback Backend Zod enum não aceita 'cancelado' em PUT.
     * Mantido em Supabase.
     */
    cancelar: _sb.operacoes.cancelar.bind(_sb.operacoes),

    /** Cria operação vinculada a item de levantamento (verifica duplicata). */
    criarParaItem: async (
      params: Parameters<typeof _sb.operacoes.criarParaItem>[0],
    ): Promise<void> => {
      try {
        return await http.post('/operacoes/criar-para-item', {
          itemLevantamentoId: params.itemLevantamentoId,
          prioridade: params.prioridade,
          observacao: params.observacao,
        });
      } catch {
        return _sb.operacoes.criarParaItem(params);
      }
    },

    /** Envia equipe para item — cria operação em andamento com responsável. */
    enviarEquipeParaItem: async (
      params: Parameters<typeof _sb.operacoes.enviarEquipeParaItem>[0],
    ): Promise<void> => {
      try {
        return await http.post('/operacoes/enviar-equipe', {
          itemLevantamentoId: params.itemLevantamentoId,
          responsavelId: params.responsavelId,
          prioridade: params.prioridade,
          observacao: params.observacao,
          status: 'em_andamento',
          tipoVinculo: 'levantamento',
        });
      } catch {
        return _sb.operacoes.enviarEquipeParaItem(params);
      }
    },

    /** Atualiza status de uma operação. Fallback cobre statuses fora do enum do backend. */
    atualizarStatus: async (id: string, newStatus: string): Promise<void> => {
      try {
        return await http.put(`/operacoes/${id}`, { status: newStatus });
      } catch {
        return _sb.operacoes.atualizarStatus(id, newStatus);
      }
    },

    /** Remove (soft delete) uma operação. */
    remover: async (id: string): Promise<void> => {
      try {
        return await http.delete(`/operacoes/${id}`);
      } catch {
        return _sb.operacoes.remover(id);
      }
    },

    /** Resolve item de foco via transição de estado (já migrado em focosRisco). */
    resolverStatusItem: _sb.operacoes.resolverStatusItem.bind(_sb.operacoes),

    // ── Fallback Supabase — sem endpoint NestJS equivalente ────────────────
    /** @fallback Upsert complexo (ensure + update): sem endpoint NestJS. */
    ensureEmAndamento: _sb.operacoes.ensureEmAndamento.bind(_sb.operacoes),
    /** @fallback Upsert genérico: sem endpoint NestJS. */
    upsert: _sb.operacoes.upsert.bind(_sb.operacoes),
    /** @fallback Bulk insert (pipeline drone): sem endpoint NestJS. */
    bulkInsert: _sb.operacoes.bulkInsert.bind(_sb.operacoes),
    /** @fallback Filtra IDs com operação aberta (pipeline drone): sem endpoint NestJS. */
    listExistingItemIds: _sb.operacoes.listExistingItemIds.bind(_sb.operacoes),
    /** @fallback Remoção direta: sem endpoint NestJS (use remover() para soft delete). */
    concluirParaItem: _sb.operacoes.concluirParaItem.bind(_sb.operacoes),
  },

  // ── operacoesSla — HTTP parcial + fallback Supabase ────────────────────────
  operacoesSla: {
    /** Adiciona evidência fotográfica a uma operação. */
    addEvidencia: async (
      operacaoId: string,
      imageUrl: string,
      legenda: string | null,
    ): Promise<void> => {
      try {
        return await http.post(`/operacoes/${operacaoId}/evidencias`, { imageUrl, legenda });
      } catch {
        return _sb.operacoesSla.addEvidencia(operacaoId, imageUrl, legenda);
      }
    },

    /** @fallback Upsert + conclude: lógica composta sem endpoint direto no NestJS. */
    ensureAndConcluir: _sb.operacoesSla.ensureAndConcluir.bind(_sb.operacoesSla),
  },

  // ── levantamentos — HTTP parcial + fallback Supabase ───────────────────────
  levantamentos: {
    /**
     * Lista levantamentos do cliente com filtros opcionais.
     * Resposta NestJS (camelCase) → convertida para snake_case (database.ts).
     */
    list: async (
      clienteId: string,
      filtros?: Parameters<typeof _sb.levantamentos.list>[1],
    ): Promise<Ret<typeof _sb.levantamentos.list>> => {
      try {
        const raw = await http.get(`/levantamentos${qs({ clienteId, ...filtros })}`);
        return deepToSnake(raw) as Ret<typeof _sb.levantamentos.list>;
      } catch {
        return _sb.levantamentos.list(clienteId);
      }
    },

    /**
     * Atualiza o planejamento_id de um levantamento.
     * @param levId UUID do levantamento
     * @param planejamentoId UUID do novo planejamento
     */
    updatePlanejamento: async (levId: string, planejamentoId: string): Promise<void> => {
      try {
        return await http.put(`/levantamentos/${levId}`, { planejamentoId });
      } catch {
        return _sb.levantamentos.updatePlanejamento(levId, planejamentoId);
      }
    },

    /** Busca levantamento por ID. */
    getById: async (id: string): Promise<Ret<typeof _sb.levantamentos.getById>> => {
      try {
        const raw = await http.get(`/levantamentos/${id}`);
        return deepToSnake(raw) as Ret<typeof _sb.levantamentos.getById>;
      } catch { return _sb.levantamentos.getById(id); }
    },

    /** Cria levantamento. */
    create: async (payload: Parameters<typeof _sb.levantamentos.create>[0]): Promise<Ret<typeof _sb.levantamentos.create>> => {
      try {
        const raw = await http.post('/levantamentos', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.levantamentos.create>;
      } catch { return _sb.levantamentos.create(payload); }
    },

    /** Atualiza levantamento. */
    update: async (id: string, payload: Parameters<typeof _sb.levantamentos.update>[1]): Promise<void> => {
      try { await http.put(`/levantamentos/${id}`, deepToCamel(payload)); }
      catch { return _sb.levantamentos.update(id, payload); }
    },

    /** Lista levantamentos de um planejamento. */
    listByPlanejamento: async (planejamentoId: string): Promise<Ret<typeof _sb.levantamentos.listByPlanejamento>> => {
      try {
        const raw = await http.get(`/levantamentos${qs({ planejamentoId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.levantamentos.listByPlanejamento>;
      } catch { return _sb.levantamentos.listByPlanejamento?.(planejamentoId); }
    },

    // ── Fallback Supabase ──────────────────────────────────────────────────
    /** @fallback Configuração de fonte: sem endpoint NestJS equivalente. */
    listConfigFonteMap: _sb.levantamentos.listConfigFonteMap.bind(_sb.levantamentos),
    delete: _sb.levantamentos.delete?.bind(_sb.levantamentos),
  },

  // ── itens — HTTP parcial + fallback Supabase ───────────────────────────────
  itens: {
    /**
     * Cria item manual via RPC substituída pelo endpoint NestJS.
     * Params: snake_case (frontend) → deepToCamel → backend DTO (camelCase).
     * Resposta: camelCase → deepToSnake → snake_case (database.ts).
     */
    criarManual: async (
      params: Parameters<typeof _sb.itens.criarManual>[0],
    ): Promise<Ret<typeof _sb.itens.criarManual>> => {
      try {
        const body = deepToCamel(params);
        const raw = await http.post('/levantamentos/item-manual', body);
        return deepToSnake(raw) as Ret<typeof _sb.itens.criarManual>;
      } catch {
        return _sb.itens.criarManual(params);
      }
    },

    // ── HTTP NestJS ────────────────────────────────────────────────────────
    /** Lista itens de um levantamento. */
    listByLevantamento: async (levantamentoId: string): Promise<Ret<typeof _sb.itens.listByLevantamento>> => {
      try {
        const raw = await http.get(`/levantamentos/${levantamentoId}/itens`);
        return deepToSnake(raw) as Ret<typeof _sb.itens.listByLevantamento>;
      } catch { return _sb.itens.listByLevantamento(levantamentoId); }
    },
    // ── Fallback Supabase ──────────────────────────────────────────────────
    /** @fallback updateAtendimento é no-op legado. */
    updateAtendimento: _sb.itens.updateAtendimento.bind(_sb.itens),
    /** @fallback Demais métodos de itens: sem endpoint NestJS mapeado. */
    getById: _sb.itens.getById?.bind(_sb.itens),
    update: _sb.itens.update?.bind(_sb.itens),
    delete: _sb.itens.delete?.bind(_sb.itens),
    addEvidencia: _sb.itens.addEvidencia?.bind(_sb.itens),
    listByFoco: _sb.itens.listByFoco?.bind(_sb.itens),
    /** @fallback Métodos analíticos e de enriquecimento: sem endpoint NestJS. */
    listByCliente: _sb.itens.listByCliente.bind(_sb.itens),
    countStatusAtendimentoByCliente: _sb.itens.countStatusAtendimentoByCliente.bind(_sb.itens),
    listRecentResolvidosPorCliente: _sb.itens.listRecentResolvidosPorCliente.bind(_sb.itens),
    listDetecoes: _sb.itens.listDetecoes.bind(_sb.itens),
    getDetectionBbox: _sb.itens.getDetectionBbox.bind(_sb.itens),
    registrarCheckin: _sb.itens.registrarCheckin.bind(_sb.itens),
    listByOperador: _sb.itens.listByOperador.bind(_sb.itens),
    listMapByCliente: _sb.itens.listMapByCliente.bind(_sb.itens),
    updateObservacaoAtendimento: _sb.itens.updateObservacaoAtendimento.bind(_sb.itens),
    listStatusHistorico: _sb.itens.listStatusHistorico.bind(_sb.itens),
    listByClienteAndPeriod: _sb.itens.listByClienteAndPeriod.bind(_sb.itens),
  },

  // ── imoveis — HTTP (list/create/update/resumo/problematicos) + fallback Supabase ──────────────
  imoveis: {
    /**
     * Lista imóveis do cliente, filtrado por regiaoId opcional.
     * NestJS retorna camelCase → deepToSnake → Imovel[] (snake_case).
     */
    list: async (
      clienteId: string,
      regiaoId?: string,
    ): Promise<Ret<typeof _sb.imoveis.list>> => {
      const raw = await http.get(`/imoveis${qs({ clienteId, regiaoId, ativo: true })}`);
      return deepToSnake(raw) as Ret<typeof _sb.imoveis.list>;
    },

    /** Cria imóvel via NestJS. Payload snake_case → camelCase → backend. Resposta → snake_case. */
    create: async (
      payload: Parameters<typeof _sb.imoveis.create>[0],
    ): Promise<Ret<typeof _sb.imoveis.create>> => {
      const raw = await http.post('/imoveis', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.imoveis.create>;
    },

    /** Atualiza imóvel parcialmente. Payload snake_case → camelCase → PUT /imoveis/:id. */
    update: async (
      id: string,
      payload: Parameters<typeof _sb.imoveis.update>[1],
    ): Promise<void> => {
      await http.put(`/imoveis/${id}`, deepToCamel(payload));
    },

    /** Marca/desmarca prioridade de drone. Atalho para PUT /imoveis/:id. */
    marcarPrioridadeDrone: async (imovelId: string, valor: boolean): Promise<void> => {
      await http.put(`/imoveis/${imovelId}`, { prioridadeDrone: valor });
    },

    /** Atualiza perfil do imóvel (ausência, animal, calha…). Payload snake_case → camelCase. */
    atualizarPerfil: async (
      imovelId: string,
      payload: Parameters<typeof _sb.imoveis.atualizarPerfil>[1],
    ): Promise<void> => {
      await http.put(`/imoveis/${imovelId}`, deepToCamel(payload));
    },

    /** HTTP GET /imoveis/resumo — substitui v_imovel_resumo. */
    listResumo: async (
      clienteId: string,
      regiaoId?: string,
    ): Promise<Ret<typeof _sb.imoveis.listResumo>> => {
      try {
        const raw = await http.get(`/imoveis/resumo${qs({ regiaoId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.imoveis.listResumo>;
      } catch {
        return _sb.imoveis.listResumo(clienteId, regiaoId);
      }
    },

    /** HTTP GET /imoveis/:id/resumo — substitui v_imovel_resumo por id. */
    getResumoById: async (id: string): Promise<Ret<typeof _sb.imoveis.getResumoById>> => {
      try {
        const raw = await http.get(`/imoveis/${id}/resumo`);
        return deepToSnake(raw) as Ret<typeof _sb.imoveis.getResumoById>;
      } catch {
        return _sb.imoveis.getResumoById(id);
      }
    },

    /** HTTP GET /imoveis/problematicos — substitui v_imovel_historico_acesso. */
    listProblematicos: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.imoveis.listProblematicos>> => {
      try {
        const raw = await http.get('/imoveis/problematicos');
        return deepToSnake(raw) as Ret<typeof _sb.imoveis.listProblematicos>;
      } catch {
        return _sb.imoveis.listProblematicos(clienteId);
      }
    },
    /** @fallback Busca por endereço (ilike): filtro não confirmado no backend. */
    findByEndereco: _sb.imoveis.findByEndereco.bind(_sb.imoveis),
    /** @fallback Contagem prioridade drone: sem endpoint NestJS. */
    countPrioridadeDroneByCliente: _sb.imoveis.countPrioridadeDroneByCliente.bind(_sb.imoveis),
    /** @fallback Chaves existentes para deduplicação: sem endpoint NestJS. */
    buscarChavesExistentes: _sb.imoveis.buscarChavesExistentes.bind(_sb.imoveis),
    /** @fallback Importação em lote: sem endpoint NestJS. */
    batchCreate: _sb.imoveis.batchCreate.bind(_sb.imoveis),
  },

  // ── clientes — HTTP parcial + fallback Supabase ────────────────────────────
  clientes: {
    /**
     * Lista clientes ativos (ativo=true). Resposta camelCase → snake_case.
     * Equivalente a supabase.from('clientes').select('*').eq('ativo', true).
     */
    list: async (): Promise<Ret<typeof _sb.clientes.list>> => {
      const raw = await http.get(`/clientes${qs({ ativo: true })}`);
      return deepToSnake(raw) as Ret<typeof _sb.clientes.list>;
    },

    /**
     * Lista todos os clientes incluindo inativos (para admin).
     * Backend não tem param de ativo, retorna tudo sem filtro.
     */
    listAll: async (): Promise<Ret<typeof _sb.clientes.listAll>> => {
      const raw = await http.get('/clientes');
      return deepToSnake(raw) as Ret<typeof _sb.clientes.listAll>;
    },

    /**
     * Retorna id e nome de um cliente.
     * Chama GET /clientes/:id (retorna cliente completo) e extrai apenas id, nome.
     */
    getById: async (id: string): Promise<Ret<typeof _sb.clientes.getById>> => {
      const raw = await http.get(`/clientes/${id}`) as Record<string, unknown>;
      if (!raw) return null;
      // Backend retorna camelCase; pegamos id (invariante) e nome antes de converter
      return { id: raw.id as string, nome: raw.nome as string };
    },

    /**
     * Retorna campos de configuração UF/IBGE do cliente.
     * Chama GET /clientes/:id e extrai id, uf, ibge_municipio (via deepToSnake).
     */
    getConfig: async (id: string): Promise<Ret<typeof _sb.clientes.getConfig>> => {
      const raw = await http.get(`/clientes/${id}`) as Record<string, unknown>;
      if (!raw) return null;
      const snake = deepToSnake(raw) as Record<string, unknown>;
      return {
        id: snake.id as string,
        uf: snake.uf as string | null,
        ibge_municipio: snake.ibge_municipio as string | null,
      };
    },

    /** Cria cliente. Payload snake_case → camelCase. Resposta camelCase → snake_case. */
    create: async (
      payload: Parameters<typeof _sb.clientes.create>[0],
    ): Promise<Ret<typeof _sb.clientes.create>> => {
      const raw = await http.post('/clientes', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.clientes.create>;
    },

    /** Atualiza cliente parcialmente. Payload snake_case → camelCase → PUT /clientes/:id. */
    update: async (
      id: string,
      payload: Parameters<typeof _sb.clientes.update>[1],
    ): Promise<void> => {
      await http.put(`/clientes/${id}`, deepToCamel(payload));
    },

    /**
     * @fallback Usado pelo portal público /denunciar (sem autenticação).
     * O endpoint NestJS GET /clientes/resolver-coordenada tem AuthGuard → não serve para público.
     * Mantido no Supabase.
     */
    resolverPorCoordenada: _sb.clientes.resolverPorCoordenada.bind(_sb.clientes),
  },

  // ── planejamentos — HTTP + fallback Supabase ──────────────────────────────
  planejamentos: {
    /**
     * Lista todos os planejamentos do cliente (não deletados).
     * NestJS retorna camelCase → deepToSnake → Planejamento[].
     */
    listByCliente: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.planejamentos.listByCliente>> => {
      try {
        const raw = await http.get(`/planejamentos${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listByCliente>;
      } catch {
        return _sb.planejamentos.listByCliente(clienteId);
      }
    },

    /** Lista planejamentos ativos do cliente (ativo=true). */
    listAtivosByCliente: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.planejamentos.listAtivosByCliente>> => {
      try {
        const raw = await http.get(`/planejamentos/ativos${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listAtivosByCliente>;
      } catch {
        return _sb.planejamentos.listAtivosByCliente(clienteId);
      }
    },

    /** Lista planejamentos ativos com tipo MANUAL (para criar item manual). */
    listAtivosManuaisByCliente: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.planejamentos.listAtivosManuaisByCliente>> => {
      try {
        const raw = await http.get(`/planejamentos/ativos-manuais${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listAtivosManuaisByCliente>;
      } catch {
        return _sb.planejamentos.listAtivosManuaisByCliente(clienteId);
      }
    },

    /**
     * Cria ou atualiza um planejamento.
     * Se id fornecido → PUT /planejamentos/:id; caso contrário → POST /planejamentos.
     * Payload snake_case → deepToCamel → backend DTO.
     */
    upsert: async (payload: Record<string, unknown>, id?: string): Promise<void> => {
      try {
        const body = deepToCamel(payload) as Record<string, unknown>;
        if (id) {
          await http.put(`/planejamentos/${id}`, body);
        } else {
          await http.post('/planejamentos', body);
        }
      } catch {
        return _sb.planejamentos.upsert(payload, id);
      }
    },

    /** Remove um planejamento (soft delete). */
    remove: async (id: string): Promise<void> => {
      try {
        await http.delete(`/planejamentos/${id}`);
      } catch {
        return _sb.planejamentos.remove(id);
      }
    },

    // ── Fallback Supabase — sem endpoint NestJS equivalente ────────────────
    /** @fallback Inclui join de clientes no retorno — ViewModel não embeds cliente. */
    listWithClienteByCliente: _sb.planejamentos.listWithClienteByCliente.bind(_sb.planejamentos),
    /** @fallback Voos pertencem ao módulo drone, sem endpoint em /planejamentos. */
    voosByPlanejamento: _sb.planejamentos.voosByPlanejamento.bind(_sb.planejamentos),
  },

  // ── ciclos — HTTP + fallback Supabase ─────────────────────────────────────
  ciclos: {
    /**
     * Lista histórico de ciclos do cliente (todos os ciclos, ordenados desc).
     * NestJS retorna camelCase → deepToSnake → ciclos[].
     */
    listHistorico: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.ciclos.listHistorico>> => {
      try {
        const raw = await http.get(`/ciclos${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.ciclos.listHistorico>;
      } catch {
        return _sb.ciclos.listHistorico(clienteId);
      }
    },

    /**
     * Abre um ciclo bimestral via POST /ciclos/abrir.
     * Payload snake_case → camelCase. Resposta { ok, cicloId, numero, ano } → deepToSnake.
     */
    abrir: async (
      clienteId: string,
      params: Parameters<typeof _sb.ciclos.abrir>[1],
    ): Promise<Ret<typeof _sb.ciclos.abrir>> => {
      try {
        const body = deepToCamel({
          cliente_id: clienteId,
          ...params,
        }) as Record<string, unknown>;
        const raw = await http.post('/ciclos/abrir', body);
        return deepToSnake(raw) as Ret<typeof _sb.ciclos.abrir>;
      } catch {
        return _sb.ciclos.abrir(clienteId, params);
      }
    },

    /**
     * Fecha um ciclo bimestral via POST /ciclos/fechar.
     * Payload snake_case → camelCase. Resposta → deepToSnake.
     */
    fechar: async (
      clienteId: string,
      params: Parameters<typeof _sb.ciclos.fechar>[1],
    ): Promise<Ret<typeof _sb.ciclos.fechar>> => {
      try {
        const body = deepToCamel({
          cliente_id: clienteId,
          ...params,
        }) as Record<string, unknown>;
        const raw = await http.post('/ciclos/fechar', body);
        return deepToSnake(raw) as Ret<typeof _sb.ciclos.fechar>;
      } catch {
        return _sb.ciclos.fechar(clienteId, params);
      }
    },

    // ── HTTP NestJS ────────────────────────────────────────────────────────
    /** HTTP GET /ciclos/ativo — substitui v_ciclo_ativo. */
    getCicloAtivo: async (_clienteId: string): Promise<Ret<typeof _sb.ciclos.getCicloAtivo>> => {
      try {
        const raw = await http.get('/ciclos/ativo');
        return deepToSnake(raw) as Ret<typeof _sb.ciclos.getCicloAtivo>;
      } catch {
        return _sb.ciclos.getCicloAtivo(_clienteId);
      }
    },
    /** HTTP GET /ciclos/progresso — substitui v_ciclo_progresso. */
    getProgresso: async (_clienteId: string): Promise<Ret<typeof _sb.ciclos.getProgresso>> => {
      try {
        const raw = await http.get('/ciclos/progresso');
        return deepToSnake(raw) as Ret<typeof _sb.ciclos.getProgresso>;
      } catch {
        return _sb.ciclos.getProgresso(_clienteId);
      }
    },
    /** @fallback RPC copiar_distribuicao_ciclo: sem endpoint NestJS. */
    copiarDistribuicao: _sb.ciclos.copiarDistribuicao.bind(_sb.ciclos),
  },

  // ── usuarios — HTTP parcial + fallback Supabase ────────────────────────────
  //
  // CONTEXTO: o backend /usuarios tem apenas 4 endpoints (filter, pagination,
  // papeis, create). Faltam: PUT /:id, soft-delete, papel update/delete,
  // check-email, onboarding. Além disso, UsuarioViewModel não inclui auth_id
  // nem cliente.nome (join ausente), e retorna papeis[] (array) em vez de
  // papel (string) — incompatível com UsuarioComPapel do frontend.
  //
  // Por isso, apenas listPapeis migra agora. Os demais permanecem em Supabase
  // até o backend completar os endpoints faltantes.
  //
  usuarios: {
    /**
     * Lista papéis dos usuários de um cliente via REST (substitui RPC get_papeis_by_cliente + fallback manual).
     * Backend retorna { usuario_id, papel }[] diretamente (sem ViewModel).
     */
    listPapeis: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.usuarios.listPapeis>> => {
      try { return await http.get(`/usuarios/papeis${qs({ clienteId })}`); }
      catch { return _sb.usuarios.listPapeis(clienteId); }
    },

    /**
     * Lista usuários de um cliente via REST.
     * Nota: ViewModel não inclui auth_id nem papel (string); fallback se forma incompatível.
     */
    listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.usuarios.listByCliente>> => {
      try {
        const raw = await http.get(`/usuarios${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.usuarios.listByCliente>;
      } catch { return _sb.usuarios.listByCliente(clienteId); }
    },

    /**
     * Lista todos os usuários (admin) via REST.
     */
    listAll: async (): Promise<Ret<typeof _sb.usuarios.listAll>> => {
      try {
        const raw = await http.get('/usuarios');
        return deepToSnake(raw) as Ret<typeof _sb.usuarios.listAll>;
      } catch { return _sb.usuarios.listAll(); }
    },

    // ── Fallback Supabase — sem endpoint NestJS equivalente ────────────────
    /** @fallback Lógica RPC + filtro agente/operador sem equivalente NestJS. */
    listAgentes: _sb.usuarios.listAgentes.bind(_sb.usuarios),
    /** @fallback Sem endpoint NestJS (listAllPapeis sem filtro de cliente). */
    listAllPapeis: _sb.usuarios.listAllPapeis.bind(_sb.usuarios),
    /** @fallback Sem endpoint NestJS. */
    checkEmailExists: _sb.usuarios.checkEmailExists.bind(_sb.usuarios),
    /** @fallback Insert raw — comportamento diferente do POST /usuarios (que provisiona auth). */
    insert: _sb.usuarios.insert.bind(_sb.usuarios),
    /** @fallback Sem PUT /usuarios/:id no backend. */
    update: _sb.usuarios.update.bind(_sb.usuarios),
    /** @fallback Sem endpoint de papel update no backend. */
    updatePapel: _sb.usuarios.updatePapel.bind(_sb.usuarios),
    /** @fallback Idem updatePapel (RPC rpc_set_papel_usuario). */
    setPapel: _sb.usuarios.setPapel.bind(_sb.usuarios),
    /** @fallback Sem endpoint de deleção de papéis no backend. */
    deletePapeis: _sb.usuarios.deletePapeis.bind(_sb.usuarios),
    /** @fallback Sem DELETE /usuarios/:id (soft delete) no backend. */
    remove: _sb.usuarios.remove.bind(_sb.usuarios),
    /** @fallback Sem endpoint de onboarding no backend. */
    marcarOnboardingConcluido: _sb.usuarios.marcarOnboardingConcluido.bind(_sb.usuarios),
  },

  // ── regioes — HTTP /regioes + fallback Supabase ────────────────────────────
  //
  // Nota: RegiaoViewModel usa { nome } mas frontend pode esperar { regiao }.
  // Adaptamos: { ...raw, regiao: raw.nome ?? raw.regiao } para compatibilidade.
  //
  regioes: {
    /** Lista regiões do cliente. Adapta nome→regiao para compatibilidade. */
    listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.regioes.listByCliente>> => {
      try {
        const raw = await http.get(`/regioes${qs({ clienteId })}`);
        const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
        return deepToSnake(arr.map((r) => ({ ...r, regiao: r.nome ?? r.regiao }))) as Ret<typeof _sb.regioes.listByCliente>;
      } catch { return _sb.regioes.listByCliente(clienteId); }
    },
    /** Lista todas as regiões (admin). */
    listAll: async (): Promise<Ret<typeof _sb.regioes.listAll>> => {
      try {
        const raw = await http.get('/regioes');
        const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
        return deepToSnake(arr.map((r) => ({ ...r, regiao: r.nome ?? r.regiao }))) as Ret<typeof _sb.regioes.listAll>;
      } catch { return _sb.regioes.listAll(); }
    },
    /** Cria região. Retorna id (string) extraído do objeto retornado pelo backend. */
    create: async (payload: Parameters<typeof _sb.regioes.create>[0]): Promise<Ret<typeof _sb.regioes.create>> => {
      try {
        const raw = await http.post('/regioes', deepToCamel(payload)) as Record<string, unknown>;
        // Frontend espera string (id); extraímos se backend retornar objeto
        return (raw?.id ?? raw) as Ret<typeof _sb.regioes.create>;
      } catch { return _sb.regioes.create(payload); }
    },
    /** Atualiza região. */
    update: async (id: string, payload: Parameters<typeof _sb.regioes.update>[1]): Promise<void> => {
      try { await http.put(`/regioes/${id}`, deepToCamel(payload)); }
      catch { return _sb.regioes.update(id, payload); }
    },
    /** @fallback Sem DELETE /regioes/:id no backend. */
    remove: _sb.regioes.remove.bind(_sb.regioes),
    /** @fallback Sem endpoint de bulk insert no backend. */
    bulkInsert: _sb.regioes.bulkInsert.bind(_sb.regioes),
  },

  // ── planoAcaoCatalogo — HTTP (NestJS) ──────────────────────────────────────
  planoAcaoCatalogo: {
    /**
     * Lista ações ativas do cliente, ordenadas por ordem.
     * tipoItem opcional: backend recebe o valor e filtra; atenção ao risco de
     * que o backend use igualdade estrita (tipo_item=X) enquanto o Supabase
     * usava OR(tipo_item=X, tipo_item is null) — genéricas podem sumir.
     */
    listByCliente: async (
      clienteId: string,
      tipoItem?: string | null,
    ): Promise<Ret<typeof _sb.planoAcaoCatalogo.listByCliente>> => {
      try {
        const raw = await http.get(`/plano-acao${qs({ clienteId, tipoItem })}`);
        return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.listByCliente>;
      } catch { return _sb.planoAcaoCatalogo.listByCliente(clienteId, tipoItem); }
    },

    /** Lista todas as ações incluindo inativas (admin). */
    listAllByCliente: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.planoAcaoCatalogo.listAllByCliente>> => {
      try {
        const raw = await http.get(`/plano-acao/all${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.listAllByCliente>;
      } catch { return _sb.planoAcaoCatalogo.listAllByCliente(clienteId); }
    },

    /** Cria item no catálogo. Payload snake_case → camelCase. Resposta → snake_case. */
    create: async (
      payload: Parameters<typeof _sb.planoAcaoCatalogo.create>[0],
    ): Promise<Ret<typeof _sb.planoAcaoCatalogo.create>> => {
      try {
        const raw = await http.post('/plano-acao', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.create>;
      } catch { return _sb.planoAcaoCatalogo.create(payload); }
    },

    /** Atualiza item do catálogo. Payload snake_case → camelCase → PUT /plano-acao/:id. */
    update: async (
      id: string,
      payload: Parameters<typeof _sb.planoAcaoCatalogo.update>[1],
    ): Promise<void> => {
      try { await http.put(`/plano-acao/${id}`, deepToCamel(payload)); }
      catch { await _sb.planoAcaoCatalogo.update(id, payload); }
    },

    /** Remove item do catálogo. */
    remove: async (id: string): Promise<void> => {
      try { await http.delete(`/plano-acao/${id}`); }
      catch { await _sb.planoAcaoCatalogo.remove(id); }
    },
  },

  // ── resumosDiarios — HTTP parcial + fallback Supabase ──────────────────────
  resumosDiarios: {
    /**
     * Lista resumos diários do cliente (últimos 30).
     * Backend: GET /dashboard/resumos (TenantGuard injeta clienteId via JWT).
     * Resposta camelCase → deepToSnake → compatível com resumos_diarios.
     */
    list: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.resumosDiarios.list>> => {
      try {
        const raw = await http.get(`/dashboard/resumos${qs({ clienteId, limit: 30 })}`);
        return deepToSnake(raw) as Ret<typeof _sb.resumosDiarios.list>;
      } catch { return _sb.resumosDiarios.list(clienteId); }
    },

    /** @fallback Chama edge function resumo-diario — sem endpoint REST equivalente. */
    gerar: _sb.resumosDiarios.gerar.bind(_sb.resumosDiarios),
  },

  // ── scoreSurto — HTTP (NestJS) ─────────────────────────────────────────────
  scoreSurto: {
    /**
     * Score de risco de surto por região (substitui RPC rpc_score_surto_regioes).
     * Backend: GET /dashboard/score-surto?clienteId
     */
    porRegiao: async (
      clienteId: string,
    ): Promise<Ret<typeof _sb.scoreSurto.porRegiao>> => {
      try { return await http.get(`/dashboard/score-surto${qs({ clienteId })}`); }
      catch { return _sb.scoreSurto.porRegiao(clienteId); }
    },
  },

  // ── dashboardAnalitico — fallback Supabase (views sem endpoint NestJS) ──────
  //
  // BLOQUEIO: getResumo…getBairros usam views v_dashboard_analitico_*
  // sem endpoint REST no backend. relatorio/salvarRelatorio têm shapes
  // divergentes entre RPC e ViewModel. listarRelatorios: DashboardViewModel
  // não confirmado.
  //
  dashboardAnalitico: {
    /** @fallback View v_dashboard_analitico_resumo — sem endpoint NestJS. */
    getResumo: _sb.dashboardAnalitico.getResumo.bind(_sb.dashboardAnalitico),
    /** @fallback View v_dashboard_analitico_risco_territorial — sem endpoint NestJS. */
    getRiscoTerritorial: _sb.dashboardAnalitico.getRiscoTerritorial.bind(_sb.dashboardAnalitico),
    /** @fallback View v_dashboard_analitico_vulnerabilidade — sem endpoint NestJS. */
    getVulnerabilidade: _sb.dashboardAnalitico.getVulnerabilidade.bind(_sb.dashboardAnalitico),
    /** @fallback View v_dashboard_analitico_alerta_saude — sem endpoint NestJS. */
    getAlertaSaude: _sb.dashboardAnalitico.getAlertaSaude.bind(_sb.dashboardAnalitico),
    /** @fallback View v_dashboard_analitico_resultado_operacional — sem endpoint NestJS. */
    getResultadoOperacional: _sb.dashboardAnalitico.getResultadoOperacional.bind(_sb.dashboardAnalitico),
    /** @fallback View v_dashboard_analitico_imoveis_criticos — sem endpoint NestJS. */
    getImoveisCriticos: _sb.dashboardAnalitico.getImoveisCriticos.bind(_sb.dashboardAnalitico),
    /** @fallback View v_dashboard_analitico_risco_territorial (bairros) — sem endpoint NestJS. */
    getBairros: _sb.dashboardAnalitico.getBairros.bind(_sb.dashboardAnalitico),
    /** @fallback RPC rpc_gerar_relatorio_analitico — shape diverge de POST /dashboard/relatorio-analitico. */
    relatorio: _sb.dashboardAnalitico.relatorio.bind(_sb.dashboardAnalitico),
    /** @fallback Insert raw em relatorios_gerados ≠ POST /dashboard/relatorios (use case). */
    salvarRelatorio: _sb.dashboardAnalitico.salvarRelatorio.bind(_sb.dashboardAnalitico),
    /** @fallback Shape DashboardViewModel.relatorioToHttp não confirmado. */
    listarRelatorios: _sb.dashboardAnalitico.listarRelatorios.bind(_sb.dashboardAnalitico),
  },

  // ── central — HTTP parcial + fallback Supabase ────────────────────────────
  // Consumido por: useCentralOperacional
  central: {
    /** HTTP GET /dashboard/central-kpis — substitui v_central_operacional. */
    getKpis: async (): Promise<Ret<typeof _sb.central.getKpis>> => {
      try {
        const raw = await http.get('/dashboard/central-kpis');
        return deepToSnake(raw) as Ret<typeof _sb.central.getKpis>;
      } catch {
        return _sb.central.getKpis();
      }
    },
    /** HTTP GET /dashboard/imoveis-para-hoje — substitui v_imoveis_para_hoje (territorio_score). */
    listImoveisParaHoje: async (
      clienteId: string,
      limit = 30,
    ): Promise<Ret<typeof _sb.central.listImoveisParaHoje>> => {
      try {
        const raw = await http.get(`/dashboard/imoveis-para-hoje${qs({ limit })}`);
        return deepToSnake(raw) as Ret<typeof _sb.central.listImoveisParaHoje>;
      } catch {
        return _sb.central.listImoveisParaHoje(clienteId, limit);
      }
    },
  },

  // ── executivo — fallback Supabase (views sem endpoint NestJS) ─────────────
  // Consumido por: usePainelExecutivo
  executivo: {
    /** @fallback View v_executivo_kpis (RLS por usuário logado) — sem endpoint NestJS. */
    getKpis: _sb.executivo.getKpis.bind(_sb.executivo),
    /** @fallback View v_executivo_tendencia — sem endpoint NestJS. */
    getTendencia: _sb.executivo.getTendencia.bind(_sb.executivo),
    /** @fallback View v_executivo_cobertura — sem endpoint NestJS. */
    getCobertura: _sb.executivo.getCobertura.bind(_sb.executivo),
    /** @fallback View v_executivo_bairros_variacao — sem endpoint NestJS. */
    getBairrosVariacao: _sb.executivo.getBairrosVariacao.bind(_sb.executivo),
    /** @fallback View v_executivo_comparativo_ciclos (RLS por usuário) — sem endpoint NestJS. */
    getComparativoCiclos: _sb.executivo.getComparativoCiclos.bind(_sb.executivo),
  },

  // ── eficacia — fallback Supabase (view + query direta) ────────────────────
  // Consumido por: useEficaciaTratamento
  eficacia: {
    /** @fallback View v_eficacia_tratamento — sem endpoint NestJS. */
    listPorDeposito: _sb.eficacia.listPorDeposito.bind(_sb.eficacia),
    /** @fallback Query direta em focos_risco com join imoveis — sem endpoint NestJS dedicado. */
    listFocosResolvidos: _sb.eficacia.listFocosResolvidos.bind(_sb.eficacia),
  },

  // ── reincidencia — fallback Supabase (views + RPC + join) ─────────────────
  // Consumido por: useReincidenciaInteligente
  reincidencia: {
    /** @fallback View v_imoveis_reincidentes — sem endpoint NestJS. */
    listImoveisReincidentes: _sb.reincidencia.listImoveisReincidentes.bind(_sb.reincidencia),
    /** @fallback View v_reincidencia_por_deposito — sem endpoint NestJS. */
    listPorDeposito: _sb.reincidencia.listPorDeposito.bind(_sb.reincidencia),
    /** @fallback View v_reincidencia_sazonalidade — sem endpoint NestJS. */
    listSazonalidade: _sb.reincidencia.listSazonalidade.bind(_sb.reincidencia),
    /** @fallback RPC fn_risco_reincidencia_imovel — sem endpoint NestJS. */
    scoreImovel: _sb.reincidencia.scoreImovel.bind(_sb.reincidencia),
    /** @fallback Query vistorias com join agente+depositos — sem endpoint NestJS. */
    historicoCiclosImovel: _sb.reincidencia.historicoCiclosImovel.bind(_sb.reincidencia),
  },

  // ── SLA sub-domínios ──────────────────────────────────────────────────────

  // slaFeriados → HTTP /sla/feriados
  slaFeriados: {
    listByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/sla/feriados${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.slaFeriados.listByCliente>;
      } catch { return _sb.slaFeriados.listByCliente(clienteId); }
    },
    create: async (payload: Parameters<typeof _sb.slaFeriados.create>[0]) => {
      try {
        const raw = await http.post('/sla/feriados', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.slaFeriados.create>;
      } catch { return _sb.slaFeriados.create(payload); }
    },
    remove: async (id: string) => {
      try { await http.delete(`/sla/feriados/${id}`); }
      catch { await _sb.slaFeriados.remove(id); }
    },
    /** @fallback RPC seed_sla_feriados_nacionais — sem endpoint NestJS. */
    seedNacionais: _sb.slaFeriados.seedNacionais.bind(_sb.slaFeriados),
  },

  // slaIminentes — HTTP GET /sla/iminentes (substitui v_slas_iminentes)
  slaIminentes: {
    listByCliente: async (_clienteId: string): Promise<Ret<typeof _sb.slaIminentes.listByCliente>> => {
      try {
        const raw = await http.get('/sla/iminentes');
        return deepToSnake(raw) as Ret<typeof _sb.slaIminentes.listByCliente>;
      } catch {
        return _sb.slaIminentes.listByCliente(_clienteId);
      }
    },
    countByCliente: async (_clienteId: string): Promise<Ret<typeof _sb.slaIminentes.countByCliente>> => {
      try {
        const raw = await http.get('/sla/iminentes') as unknown[];
        return (Array.isArray(raw) ? raw.length : 0) as Ret<typeof _sb.slaIminentes.countByCliente>;
      } catch {
        return _sb.slaIminentes.countByCliente(_clienteId);
      }
    },
  },

  // slaConfig → HTTP /sla/config
  slaConfig: {
    getByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/sla/config${qs({ clienteId })}`);
        return raw ? (deepToSnake(raw) as Ret<typeof _sb.slaConfig.getByCliente>) : null;
      } catch { return _sb.slaConfig.getByCliente(clienteId); }
    },
    upsert: async (clienteId: string, config: Record<string, unknown>, existingId?: string | null) => {
      try { await http.put('/sla/config', deepToCamel({ clienteId, config, existingId })); }
      catch { await _sb.slaConfig.upsert(clienteId, config, existingId); }
    },
  },

  // slaConfigRegiao → HTTP /sla/config/regioes
  slaConfigRegiao: {
    listByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/sla/config/regioes${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.slaConfigRegiao.listByCliente>;
      } catch { return _sb.slaConfigRegiao.listByCliente(clienteId); }
    },
    upsert: async (clienteId: string, regiaoId: string, config: Record<string, unknown>) => {
      try {
        const raw = await http.put(`/sla/config/regioes/${regiaoId}`, deepToCamel({ clienteId, config }));
        return deepToSnake(raw) as Ret<typeof _sb.slaConfigRegiao.upsert>;
      } catch { return _sb.slaConfigRegiao.upsert(clienteId, regiaoId, config); }
    },
    /** @fallback DELETE não implementado no backend — usa Supabase. */
    remove: _sb.slaConfigRegiao.remove.bind(_sb.slaConfigRegiao),
  },

  // slaErros → HTTP /sla/erros
  slaErros: {
    listByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/sla/erros${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.slaErros.listByCliente>;
      } catch { return _sb.slaErros.listByCliente(clienteId); }
    },
  },

  // slaConfigAudit — @fallback tabela sla_config_audit — sem endpoint NestJS
  slaConfigAudit: {
    listByCliente: _sb.slaConfigAudit.listByCliente.bind(_sb.slaConfigAudit),
  },

  // slaInteligente — @fallback view v_focos_risco_ativos — sem endpoint NestJS dedicado
  slaInteligente: {
    listByCliente: _sb.slaInteligente.listByCliente.bind(_sb.slaInteligente),
    listCriticos: _sb.slaInteligente.listCriticos.bind(_sb.slaInteligente),
    getByFocoId: _sb.slaInteligente.getByFocoId.bind(_sb.slaInteligente),
  },

  // ── Drones ────────────────────────────────────────────────────────────────

  // drones → HTTP /drones
  drones: {
    list: async (clienteId: string) => {
      try {
        const raw = await http.get(`/drones${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.drones.list>;
      } catch { return _sb.drones.list(clienteId); }
    },
    create: async (payload: Parameters<typeof _sb.drones.create>[0]) => {
      try {
        const raw = await http.post('/drones', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.drones.create>;
      } catch { return _sb.drones.create(payload); }
    },
    update: async (id: string, payload: Parameters<typeof _sb.drones.update>[1]) => {
      try { await http.put(`/drones/${id}`, deepToCamel(payload)); }
      catch { await _sb.drones.update(id, payload); }
    },
    remove: async (id: string) => {
      try { await http.delete(`/drones/${id}`); }
      catch { await _sb.drones.remove(id); }
    },
  },

  // voos → HTTP /drones/voos
  voos: {
    listByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/drones/voos${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.voos.listByCliente>;
      } catch { return _sb.voos.listByCliente(clienteId); }
    },
    create: async (payload: Parameters<typeof _sb.voos.create>[0]) => {
      try {
        const raw = await http.post('/drones/voos', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.voos.create>;
      } catch { return _sb.voos.create(payload); }
    },
    update: async (id: string, payload: Parameters<typeof _sb.voos.update>[1]) => {
      try { await http.put(`/drones/voos/${id}`, deepToCamel(payload)); }
      catch { await _sb.voos.update(id, payload); }
    },
    /** @fallback DELETE /drones/voos/:id — não confirmado no controller; usa Supabase. */
    remove: _sb.voos.remove.bind(_sb.voos),
    /** @fallback bulk não suportado pelo backend — usa Supabase. */
    bulkCreate: _sb.voos.bulkCreate.bind(_sb.voos),
  },

  // pipeline → HTTP /drones/pipelines
  pipeline: {
    listRuns: async (clienteId: string, limit?: number) => {
      try {
        const raw = await http.get(`/drones/pipelines${qs({ clienteId, limit })}`);
        return deepToSnake(raw) as Ret<typeof _sb.pipeline.listRuns>;
      } catch { return _sb.pipeline.listRuns(clienteId, limit); }
    },
    getRunAtivo: async (clienteId: string) => {
      try {
        const raw = await http.get(`/drones/pipelines${qs({ clienteId, status: 'em_andamento', limit: 1 })}`);
        const arr = deepToSnake(raw) as Ret<typeof _sb.pipeline.listRuns>;
        return (arr[0] ?? null) as Ret<typeof _sb.pipeline.getRunAtivo>;
      } catch { return _sb.pipeline.getRunAtivo(clienteId); }
    },
  },

  // condicoesVoo → HTTP GET /drones/condicoes-voo
  condicoesVoo: {
    avaliarByCliente: async (clienteId: string, data?: string) => {
      try {
        const raw = await http.get(`/drones/condicoes-voo${qs({ clienteId, data })}`);
        return deepToSnake(raw) as Ret<typeof _sb.condicoesVoo.avaliarByCliente>;
      } catch { return _sb.condicoesVoo.avaliarByCliente(clienteId, data); }
    },
  },

  // yoloFeedback → HTTP POST /drones/yolo-feedback
  yoloFeedback: {
    upsert: async (payload: Parameters<typeof _sb.yoloFeedback.upsert>[0]) => {
      try { await http.post('/drones/yolo-feedback', deepToCamel(payload)); }
      catch { await _sb.yoloFeedback.upsert(payload); }
    },
    /** @fallback GET não implementado no backend — usa Supabase. */
    getByItem: _sb.yoloFeedback.getByItem.bind(_sb.yoloFeedback),
  },

  // yoloClassConfig — @fallback tabela sentinela_yolo_class_config — sem endpoint NestJS
  yoloClassConfig: {
    listByCliente: _sb.yoloClassConfig.listByCliente.bind(_sb.yoloClassConfig),
  },

  // yoloQualidade — @fallback tabela vistoria_drone_correlacao — sem endpoint NestJS
  yoloQualidade: {
    resumo: _sb.yoloQualidade.resumo.bind(_sb.yoloQualidade),
  },

  // droneRiskConfig — @fallback tabelas sentinela_drone_risk_config + yolo_* — sem endpoint NestJS
  droneRiskConfig: {
    getByCliente: _sb.droneRiskConfig.getByCliente.bind(_sb.droneRiskConfig),
    update: _sb.droneRiskConfig.update.bind(_sb.droneRiskConfig),
    listYoloClasses: _sb.droneRiskConfig.listYoloClasses.bind(_sb.droneRiskConfig),
    updateYoloClass: _sb.droneRiskConfig.updateYoloClass.bind(_sb.droneRiskConfig),
    listSynonyms: _sb.droneRiskConfig.listSynonyms.bind(_sb.droneRiskConfig),
    addSynonym: _sb.droneRiskConfig.addSynonym.bind(_sb.droneRiskConfig),
    deleteSynonym: _sb.droneRiskConfig.deleteSynonym.bind(_sb.droneRiskConfig),
  },

  // ── Notificações ──────────────────────────────────────────────────────────

  // casosNotificados → HTTP /notificacoes/casos (parcial; RPC methods → fallback)
  casosNotificados: {
    list: async (clienteId: string) => {
      try {
        const raw = await http.get(`/notificacoes/casos${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.list>;
      } catch { return _sb.casosNotificados.list(clienteId); }
    },
    create: async (payload: Parameters<typeof _sb.casosNotificados.create>[0]) => {
      try {
        const raw = await http.post('/notificacoes/casos', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.create>;
      } catch { return _sb.casosNotificados.create(payload); }
    },
    updateStatus: async (id: string, status: Parameters<typeof _sb.casosNotificados.updateStatus>[1]) => {
      try { await http.put(`/notificacoes/casos/${id}`, { status }); }
      catch { await _sb.casosNotificados.updateStatus(id, status); }
    },
    update: async (id: string, payload: Parameters<typeof _sb.casosNotificados.update>[1]) => {
      try { await http.put(`/notificacoes/casos/${id}`, deepToCamel(payload)); }
      catch { await _sb.casosNotificados.update(id, payload); }
    },
    listProximosAoPonto: async (lat: number, lng: number, clienteId: string, raioMetros?: number) => {
      try {
        const raw = await http.get(`/notificacoes/casos/no-raio${qs({ lat, lng, clienteId, raioMetros })}`);
        return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.listProximosAoPonto>;
      } catch { return _sb.casosNotificados.listProximosAoPonto(lat, lng, clienteId, raioMetros); }
    },
    /** @fallback cursor pagination — schema diferente do backend; usa Supabase. */
    listPaginado: _sb.casosNotificados.listPaginado.bind(_sb.casosNotificados),
    /** @fallback RPC contar_casos_proximos_ao_item — sem endpoint NestJS. */
    countProximoAoItem: _sb.casosNotificados.countProximoAoItem.bind(_sb.casosNotificados),
    /** @fallback tabela caso_foco_cruzamento — sem endpoint NestJS. */
    cruzamentosDoItem: _sb.casosNotificados.cruzamentosDoItem.bind(_sb.casosNotificados),
    cruzamentosDoCaso: _sb.casosNotificados.cruzamentosDoCaso.bind(_sb.casosNotificados),
    countCruzadosHoje: _sb.casosNotificados.countCruzadosHoje.bind(_sb.casosNotificados),
    listCasoIdsComCruzamento: _sb.casosNotificados.listCasoIdsComCruzamento.bind(_sb.casosNotificados),
    listCruzamentos: _sb.casosNotificados.listCruzamentos.bind(_sb.casosNotificados),
  },

  // unidadesSaude → HTTP /notificacoes/unidades-saude
  unidadesSaude: {
    list: async (clienteId: string) => {
      try {
        const raw = await http.get(`/notificacoes/unidades-saude${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.unidadesSaude.list>;
      } catch { return _sb.unidadesSaude.list(clienteId); }
    },
    create: async (payload: Parameters<typeof _sb.unidadesSaude.create>[0]) => {
      try {
        const raw = await http.post('/notificacoes/unidades-saude', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.unidadesSaude.create>;
      } catch { return _sb.unidadesSaude.create(payload); }
    },
    update: async (id: string, payload: Parameters<typeof _sb.unidadesSaude.update>[1]) => {
      try { await http.put(`/notificacoes/unidades-saude/${id}`, deepToCamel(payload)); }
      catch { await _sb.unidadesSaude.update(id, payload); }
    },
  },

  // notificacoesESUS → HTTP /notificacoes/esus (parcial; enviar via Supabase — sinan.ts)
  notificacoesESUS: {
    listByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/notificacoes/esus${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.notificacoesESUS.listByCliente>;
      } catch { return _sb.notificacoesESUS.listByCliente(clienteId); }
    },
    listByItem: async (itemId: string, clienteId: string) => {
      try {
        const raw = await http.get(`/notificacoes/esus${qs({ clienteId, itemId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.notificacoesESUS.listByItem>;
      } catch { return _sb.notificacoesESUS.listByItem(itemId, clienteId); }
    },
    /** @fallback payload e-SUS complexo (sinan.ts) — usa Supabase. */
    enviar: _sb.notificacoesESUS.enviar.bind(_sb.notificacoesESUS),
    /** @fallback sem endpoint NestJS. */
    reenviar: _sb.notificacoesESUS.reenviar.bind(_sb.notificacoesESUS),
  },

  // pushSubscriptions → HTTP /notificacoes/push (parcial; listByCliente uso interno Edge Function)
  pushSubscriptions: {
    upsert: async (payload: Parameters<typeof _sb.pushSubscriptions.upsert>[0]) => {
      try { await http.post('/notificacoes/push', deepToCamel(payload)); }
      catch { await _sb.pushSubscriptions.upsert(payload); }
    },
    /** @fallback uso interno da Edge Function — sem endpoint NestJS necessário. */
    listByCliente: _sb.pushSubscriptions.listByCliente.bind(_sb.pushSubscriptions),
    /** @fallback DELETE usa endpoint/:id no backend mas frontend passa endpoint string; usa Supabase. */
    removeByEndpoint: _sb.pushSubscriptions.removeByEndpoint.bind(_sb.pushSubscriptions),
  },

  // notificacaoFormal → HTTP POST /notificacoes/protocolo/proximo
  notificacaoFormal: {
    gerarProtocolo: async (clienteId: string) => {
      try {
        const raw = await http.post('/notificacoes/protocolo/proximo', { clienteId });
        if (typeof raw === 'string') return raw;
        return ((raw as Record<string, unknown>).protocolo ?? (raw as Record<string, unknown>).numero ?? String(raw)) as string;
      } catch { return _sb.notificacaoFormal.gerarProtocolo(clienteId); }
    },
  },

  // canalCidadao — @fallback views v_canal_cidadao_stats + _eventos_audit — sem endpoint NestJS
  canalCidadao: {
    stats: _sb.canalCidadao.stats.bind(_sb.canalCidadao),
    eventosAudit: _sb.canalCidadao.eventosAudit.bind(_sb.canalCidadao),
  },

  // ── Pluvio ────────────────────────────────────────────────────────────────

  // pluvio → HTTP /pluvio/runs/latest (parcial; riscoByCliente join complexo → Supabase)
  pluvio: {
    /** @fallback join regioes+pluvio_risco — usa Supabase. */
    riscoByCliente: _sb.pluvio.riscoByCliente.bind(_sb.pluvio),
    latestRunByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/pluvio/runs/latest${qs({ clienteId })}`);
        return raw ? (deepToSnake(raw) as Ret<typeof _sb.pluvio.latestRunByCliente>) : null;
      } catch { return _sb.pluvio.latestRunByCliente(clienteId); }
    },
  },

  // pluvioOperacional → HTTP /pluvio/runs + /pluvio/items
  pluvioOperacional: {
    listRuns: async (clienteId?: string) => {
      try {
        const raw = await http.get(`/pluvio/runs${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.pluvioOperacional.listRuns>;
      } catch { return _sb.pluvioOperacional.listRuns(clienteId); }
    },
    createRun: async (payload: Parameters<typeof _sb.pluvioOperacional.createRun>[0]) => {
      try { await http.post('/pluvio/runs', deepToCamel(payload)); }
      catch { await _sb.pluvioOperacional.createRun(payload); }
    },
    createRunGetId: async (payload: Parameters<typeof _sb.pluvioOperacional.createRunGetId>[0]) => {
      try {
        const raw = await http.post('/pluvio/runs', deepToCamel(payload));
        return (deepToSnake(raw) as { id: string }).id;
      } catch { return _sb.pluvioOperacional.createRunGetId(payload); }
    },
    deleteRun: async (id: string) => {
      try { await http.delete(`/pluvio/runs/${id}`); }
      catch { await _sb.pluvioOperacional.deleteRun(id); }
    },
    updateRunTotal: async (runId: string) => {
      try { await http.patch(`/pluvio/runs/${runId}/total`, {}); }
      catch { await _sb.pluvioOperacional.updateRunTotal(runId); }
    },
    listItems: async (runId: string) => {
      try {
        const raw = await http.get(`/pluvio/runs/${runId}/items`);
        return deepToSnake(raw) as Ret<typeof _sb.pluvioOperacional.listItems>;
      } catch { return _sb.pluvioOperacional.listItems(runId); }
    },
    upsertItem: async (id: string | null, payload: Parameters<typeof _sb.pluvioOperacional.upsertItem>[1]) => {
      try { await http.put('/pluvio/items', deepToCamel({ id, ...payload })); }
      catch { await _sb.pluvioOperacional.upsertItem(id, payload); }
    },
    deleteItem: async (id: string) => {
      try { await http.delete(`/pluvio/items/${id}`); }
      catch { await _sb.pluvioOperacional.deleteItem(id); }
    },
    bulkInsertItems: async (rows: Parameters<typeof _sb.pluvioOperacional.bulkInsertItems>[0]) => {
      try { await http.post('/pluvio/items/bulk', rows.map((r) => deepToCamel(r))); }
      catch { await _sb.pluvioOperacional.bulkInsertItems(rows); }
    },
  },

  // pluvioRisco → HTTP /pluvio/risco
  pluvioRisco: {
    listByRegioes: async (regIds: string[]) => {
      if (regIds.length === 0) return [];
      try {
        const raw = await http.get(`/pluvio/risco${qs({ regiaoId: regIds })}`);
        return deepToSnake(raw) as Ret<typeof _sb.pluvioRisco.listByRegioes>;
      } catch { return _sb.pluvioRisco.listByRegioes(regIds); }
    },
    upsert: async (id: string | null, payload: Parameters<typeof _sb.pluvioRisco.upsert>[1]) => {
      try { await http.put('/pluvio/risco', deepToCamel({ id, ...payload })); }
      catch { await _sb.pluvioRisco.upsert(id, payload); }
    },
    remove: async (id: string) => {
      try { await http.delete(`/pluvio/risco/${id}`); }
      catch { await _sb.pluvioRisco.remove(id); }
    },
    bulkInsert: async (rows: Parameters<typeof _sb.pluvioRisco.bulkInsert>[0]) => {
      try { await http.post('/pluvio/risco/bulk', rows.map((r) => deepToCamel(r))); }
      catch { await _sb.pluvioRisco.bulkInsert(rows); }
    },
  },

  // ── Billing / Quotas ──────────────────────────────────────────────────────

  // billing → HTTP /billing (parcial; views/snapshots/Edge → Supabase)
  billing: {
    listPlanos: async () => {
      try {
        const raw = await http.get('/billing/planos');
        return deepToSnake(raw) as Ret<typeof _sb.billing.listPlanos>;
      } catch { return _sb.billing.listPlanos(); }
    },
    getClientePlano: async (clienteId: string) => {
      try {
        const raw = await http.get(`/billing/cliente-plano${qs({ clienteId })}`);
        return raw ? (deepToSnake(raw) as Ret<typeof _sb.billing.getClientePlano>) : null;
      } catch { return _sb.billing.getClientePlano(clienteId); }
    },
    updateClientePlano: async (clienteId: string, payload: Parameters<typeof _sb.billing.updateClientePlano>[1]) => {
      try { await http.post('/billing/cliente-plano', deepToCamel({ clienteId, ...payload })); }
      catch { await _sb.billing.updateClientePlano(clienteId, payload); }
    },
    listCiclos: async (clienteId: string) => {
      try {
        const raw = await http.get(`/billing/ciclos${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.billing.listCiclos>;
      } catch { return _sb.billing.listCiclos(clienteId); }
    },
    /** @fallback view v_billing_resumo — sem endpoint NestJS. */
    listResumo: _sb.billing.listResumo.bind(_sb.billing),
    /** @fallback tabela billing_usage_snapshot — sem endpoint NestJS. */
    listSnapshots: _sb.billing.listSnapshots.bind(_sb.billing),
    getUltimoSnapshot: _sb.billing.getUltimoSnapshot.bind(_sb.billing),
    /** @fallback Edge Function billing-snapshot — usa Supabase. */
    triggerSnapshot: _sb.billing.triggerSnapshot.bind(_sb.billing),
  },

  // quotas → HTTP /billing/quotas + /billing/uso-mensal + /billing/verificar-quota
  quotas: {
    byCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/billing/quotas${qs({ clienteId })}`);
        return raw ? (deepToSnake(raw) as Ret<typeof _sb.quotas.byCliente>) : null;
      } catch { return _sb.quotas.byCliente(clienteId); }
    },
    usoMensal: async (clienteId: string) => {
      try {
        const raw = await http.get(`/billing/uso-mensal${qs({ clienteId })}`);
        return raw ? (deepToSnake(raw) as Ret<typeof _sb.quotas.usoMensal>) : null;
      } catch { return _sb.quotas.usoMensal(clienteId); }
    },
    usoMensalAll: async () => {
      try {
        const raw = await http.get('/billing/uso-mensal/todos');
        return deepToSnake(raw) as Ret<typeof _sb.quotas.usoMensalAll>;
      } catch { return _sb.quotas.usoMensalAll(); }
    },
    verificar: async (clienteId: string, metrica: Parameters<typeof _sb.quotas.verificar>[1]) => {
      try {
        const raw = await http.get(`/billing/verificar-quota${qs({ clienteId, metrica })}`);
        return deepToSnake(raw) as Ret<typeof _sb.quotas.verificar>;
      } catch { return _sb.quotas.verificar(clienteId, metrica); }
    },
    update: async (clienteId: string, limites: Parameters<typeof _sb.quotas.update>[1]) => {
      try {
        const raw = await http.put('/billing/quotas', deepToCamel({ clienteId, ...limites }));
        return deepToSnake(raw) as Ret<typeof _sb.quotas.update>;
      } catch { return _sb.quotas.update(clienteId, limites); }
    },
  },

  // ── Quarteirões ───────────────────────────────────────────────────────────

  // quarteiroes → HTTP /quarteiroes
  quarteiroes: {
    listByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/quarteiroes${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.quarteiroes.listByCliente>;
      } catch { return _sb.quarteiroes.listByCliente(clienteId); }
    },
  },

  // distribuicaoQuarteirao → HTTP /quarteiroes/distribuicoes (parcial; RPC → fallback)
  distribuicaoQuarteirao: {
    listByCiclo: async (clienteId: string, ciclo: number) => {
      try {
        const raw = await http.get(`/quarteiroes/distribuicoes${qs({ clienteId, ciclo })}`);
        return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.listByCiclo>;
      } catch { return _sb.distribuicaoQuarteirao.listByCiclo(clienteId, ciclo); }
    },
    /** @fallback backend retorna objetos completos, frontend espera string[]; usa Supabase. */
    listByAgente: _sb.distribuicaoQuarteirao.listByAgente.bind(_sb.distribuicaoQuarteirao),
    /** @fallback upsert batch — DTO backend não confirmado; usa Supabase. */
    upsert: _sb.distribuicaoQuarteirao.upsert.bind(_sb.distribuicaoQuarteirao),
    /** @fallback DELETE por array de quarteirao strings — backend usa DELETE/:id; usa Supabase. */
    deletar: _sb.distribuicaoQuarteirao.deletar.bind(_sb.distribuicaoQuarteirao),
    copiarDoCiclo: async (clienteId: string, cicloOrigem: number, cicloDestino: number) => {
      try {
        const raw = await http.post('/quarteiroes/distribuicoes/copiar', deepToCamel({ clienteId, cicloOrigem, cicloDestino }));
        return ((raw as Record<string, unknown>).count as number) ?? 0;
      } catch { return _sb.distribuicaoQuarteirao.copiarDoCiclo(clienteId, cicloOrigem, cicloDestino); }
    },
    coberturaByCliente: async (clienteId: string, ciclo: number) => {
      try {
        const raw = await http.get(`/quarteiroes/cobertura${qs({ clienteId, ciclo })}`);
        return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.coberturaByCliente>;
      } catch { return _sb.distribuicaoQuarteirao.coberturaByCliente(clienteId, ciclo); }
    },
  },

  // ── Risk Engine ────────────────────────────────────────────────────────────

  // riskPolicy — @fallback tabela sentinela_risk_policy — sem endpoint NestJS
  riskPolicy: {
    listByCliente: _sb.riskPolicy.listByCliente.bind(_sb.riskPolicy),
    delete: _sb.riskPolicy.delete.bind(_sb.riskPolicy),
    listAllClienteIds: _sb.riskPolicy.listAllClienteIds.bind(_sb.riskPolicy),
  },

  // riskPolicyHeader — @fallback tabela sentinela_risk_policy — sem endpoint NestJS
  riskPolicyHeader: {
    create: _sb.riskPolicyHeader.create.bind(_sb.riskPolicyHeader),
    update: _sb.riskPolicyHeader.update.bind(_sb.riskPolicyHeader),
  },

  // riskPolicyEditor — @fallback sub-tabelas sentinela_risk_* — sem endpoint NestJS
  riskPolicyEditor: {
    getDefaults: _sb.riskPolicyEditor.getDefaults.bind(_sb.riskPolicyEditor),
    upsertDefaults: _sb.riskPolicyEditor.upsertDefaults.bind(_sb.riskPolicyEditor),
    listBins: _sb.riskPolicyEditor.listBins.bind(_sb.riskPolicyEditor),
    replaceBins: _sb.riskPolicyEditor.replaceBins.bind(_sb.riskPolicyEditor),
    listFactors: _sb.riskPolicyEditor.listFactors.bind(_sb.riskPolicyEditor),
    replaceFactors: _sb.riskPolicyEditor.replaceFactors.bind(_sb.riskPolicyEditor),
    listAdjusts: _sb.riskPolicyEditor.listAdjusts.bind(_sb.riskPolicyEditor),
    replaceAdjusts: _sb.riskPolicyEditor.replaceAdjusts.bind(_sb.riskPolicyEditor),
    listTendenciaAdjusts: _sb.riskPolicyEditor.listTendenciaAdjusts.bind(_sb.riskPolicyEditor),
    replaceTendenciaAdjusts: _sb.riskPolicyEditor.replaceTendenciaAdjusts.bind(_sb.riskPolicyEditor),
    listRules: _sb.riskPolicyEditor.listRules.bind(_sb.riskPolicyEditor),
    replaceRules: _sb.riskPolicyEditor.replaceRules.bind(_sb.riskPolicyEditor),
    getFallbackRule: _sb.riskPolicyEditor.getFallbackRule.bind(_sb.riskPolicyEditor),
    upsertFallbackRule: _sb.riskPolicyEditor.upsertFallbackRule.bind(_sb.riskPolicyEditor),
    importAll: _sb.riskPolicyEditor.importAll.bind(_sb.riskPolicyEditor),
  },

  // ── LIRAa ─────────────────────────────────────────────────────────────────

  // liraa — @fallback RPC rpc_calcular_liraa + view v_liraa_quarteirao + Edge Function — sem endpoint NestJS
  liraa: {
    calcular: _sb.liraa.calcular.bind(_sb.liraa),
    consumoLarvicida: _sb.liraa.consumoLarvicida.bind(_sb.liraa),
    listPorQuarteirao: _sb.liraa.listPorQuarteirao.bind(_sb.liraa),
    listCiclosDisponiveis: _sb.liraa.listCiclosDisponiveis.bind(_sb.liraa),
    exportarPdf: _sb.liraa.exportarPdf.bind(_sb.liraa),
  },

  // ── Score Territorial ──────────────────────────────────────────────────────

  // score — @fallback tabela territorio_score + view v_score_bairro — sem endpoint NestJS
  score: {
    getImovel: _sb.score.getImovel.bind(_sb.score),
    listTopCriticos: _sb.score.listTopCriticos.bind(_sb.score),
    listBairros: _sb.score.listBairros.bind(_sb.score),
    getConfig: _sb.score.getConfig.bind(_sb.score),
    forcarRecalculo: _sb.score.forcarRecalculo.bind(_sb.score),
    upsertConfig: _sb.score.upsertConfig.bind(_sb.score),
  },

  // ── System Health ──────────────────────────────────────────────────────────

  // systemHealth → HTTP /dashboard/health + /dashboard/alerts (parcial)
  systemHealth: {
    listLogs: async (servico?: string, limit?: number) => {
      try {
        const raw = await http.get(`/dashboard/health${qs({ servico, limit })}`);
        return deepToSnake(raw) as Ret<typeof _sb.systemHealth.listLogs>;
      } catch { return _sb.systemHealth.listLogs(servico, limit); }
    },
    latestByServico: async () => {
      try {
        const raw = await http.get('/dashboard/health');
        return deepToSnake(raw) as Ret<typeof _sb.systemHealth.latestByServico>;
      } catch { return _sb.systemHealth.latestByServico(); }
    },
    listAlerts: async (apenasAtivos?: boolean) => {
      try {
        const raw = await http.get(`/dashboard/alerts${qs({ apenasAtivos })}`);
        return deepToSnake(raw) as Ret<typeof _sb.systemHealth.listAlerts>;
      } catch { return _sb.systemHealth.listAlerts(apenasAtivos); }
    },
    /** @fallback UPDATE — sem endpoint NestJS; usa Supabase. */
    resolverAlerta: _sb.systemHealth.resolverAlerta.bind(_sb.systemHealth),
    /** @fallback Edge Function health-check — usa Supabase. */
    triggerHealthCheck: _sb.systemHealth.triggerHealthCheck.bind(_sb.systemHealth),
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  // admin — @fallback query focos_risco+clientes — sem endpoint NestJS dedicado
  admin: {
    comparativoMunicipios: _sb.admin.comparativoMunicipios.bind(_sb.admin),
  },

  // ── IA ────────────────────────────────────────────────────────────────────

  // analiseIa — @fallback tabela levantamento_analise_ia + RPC fn_enqueue_job — sem endpoint NestJS confirmado
  analiseIa: {
    getByLevantamento: _sb.analiseIa.getByLevantamento.bind(_sb.analiseIa),
    triggerTriagem: _sb.analiseIa.triggerTriagem.bind(_sb.analiseIa),
  },

  // iaInsights — @fallback tabela ia_insights + Edge Function resumo-diario — sem endpoint NestJS
  iaInsights: {
    getResumo: _sb.iaInsights.getResumo.bind(_sb.iaInsights),
    gerar: _sb.iaInsights.gerar.bind(_sb.iaInsights),
  },

  // identifyLarva — @fallback Edge Function identify-larva — sem endpoint NestJS
  identifyLarva: {
    invoke: _sb.identifyLarva.invoke.bind(_sb.identifyLarva),
  },

  // ── Import / Sync ─────────────────────────────────────────────────────────

  // importLog → HTTP /import-log (parcial; finalizar não existe no backend — imutável)
  importLog: {
    /** HTTP POST /import-log — cria log de importação. */
    criar: async (payload: Parameters<typeof _sb.importLog.criar>[0]) => {
      try {
        const raw = await http.post('/import-log', deepToCamel(payload));
        return deepToSnake(raw) as Ret<typeof _sb.importLog.criar>;
      } catch { return _sb.importLog.criar(payload); }
    },
    /** @fallback backend não tem endpoint PATCH/finalizar (log imutável). */
    finalizar: _sb.importLog.finalizar.bind(_sb.importLog),
    /** HTTP GET /import-log?clienteId=X — lista logs do cliente. */
    listarByCliente: async (clienteId: string) => {
      try {
        const raw = await http.get(`/import-log${qs({ clienteId })}`);
        return deepToSnake(raw) as Ret<typeof _sb.importLog.listarByCliente>;
      } catch { return _sb.importLog.listarByCliente(clienteId); }
    },
  },

  // cnesSync — @fallback Edge Function cnes-sync + tabelas unidades_saude_sync_* — sem endpoint NestJS
  cnesSync: {
    sincronizarManual: _sb.cnesSync.sincronizarManual.bind(_sb.cnesSync),
    listarControle: _sb.cnesSync.listarControle.bind(_sb.cnesSync),
    listarLog: _sb.cnesSync.listarLog.bind(_sb.cnesSync),
    emAndamento: _sb.cnesSync.emAndamento.bind(_sb.cnesSync),
  },

  // offlineSyncLog — @fallback tabela offline_sync_log — fire-and-forget; sem endpoint NestJS
  offlineSyncLog: {
    registrar: _sb.offlineSyncLog.registrar.bind(_sb.offlineSyncLog),
  },

  // ── Jobs ──────────────────────────────────────────────────────────────────

  // jobQueue — @fallback RPC fn_enqueue_job + tabela job_queue — sem endpoint NestJS confirmado
  jobQueue: {
    enqueue: _sb.jobQueue.enqueue.bind(_sb.jobQueue),
    list: _sb.jobQueue.list.bind(_sb.jobQueue),
    get: _sb.jobQueue.get.bind(_sb.jobQueue),
    retry: _sb.jobQueue.retry.bind(_sb.jobQueue),
    cancel: _sb.jobQueue.cancel.bind(_sb.jobQueue),
  },

  // ── Cloudinary ────────────────────────────────────────────────────────────

  // cloudinary → HTTP /cloudinary
  cloudinary: {
    /** HTTP POST /cloudinary/upload — upload de imagem em base64. */
    uploadImage: async (payload: Parameters<typeof _sb.cloudinary.uploadImage>[0]) => {
      try {
        return await http.post('/cloudinary/upload', deepToCamel(payload));
      } catch { return _sb.cloudinary.uploadImage(payload); }
    },
    /** HTTP DELETE /cloudinary/:publicId — remove imagem do Cloudinary. */
    deleteImage: async (publicId: Parameters<typeof _sb.cloudinary.deleteImage>[0]) => {
      try {
        await http.delete(`/cloudinary/${encodeURIComponent(String(publicId))}`);
      } catch { return _sb.cloudinary.deleteImage(publicId); }
    },
  },

  // cloudinaryOrfaos — @fallback tabela cloudinary_orfaos — sem endpoint NestJS confirmado
  cloudinaryOrfaos: {
    listar: _sb.cloudinaryOrfaos.listar.bind(_sb.cloudinaryOrfaos),
  },

  // ── Levantamentos / Evidências ────────────────────────────────────────────

  // evidenciasItem — @fallback tabela operacao_evidencias — sem endpoint NestJS
  evidenciasItem: {
    add: _sb.evidenciasItem.add.bind(_sb.evidenciasItem),
  },

  // levantamentoItemEvidencias — @fallback tabela levantamento_item_evidencias — sem endpoint NestJS
  levantamentoItemEvidencias: {
    listByItem: _sb.levantamentoItemEvidencias.listByItem.bind(_sb.levantamentoItemEvidencias),
  },

  // ── Mapa ──────────────────────────────────────────────────────────────────

  // map — @fallback join complexo (levantamentos+clientes+planejamentos+regioes+pluvio_risco) — sem endpoint NestJS
  map: {
    fullDataByCliente: _sb.map.fullDataByCliente.bind(_sb.map),
    itemStatusesByCliente: _sb.map.itemStatusesByCliente.bind(_sb.map),
  },

  // ── Miscelâneos ───────────────────────────────────────────────────────────

  // tags — @fallback tabela tags — sem endpoint NestJS
  tags: {
    list: _sb.tags.list.bind(_sb.tags),
  },

  // recorrencias — @fallback focos_risco agrupados — sem endpoint NestJS
  recorrencias: {
    listAtivasByCliente: _sb.recorrencias.listAtivasByCliente.bind(_sb.recorrencias),
    countAtivasByCliente: _sb.recorrencias.countAtivasByCliente.bind(_sb.recorrencias),
    listItensByRecorrencia: _sb.recorrencias.listItensByRecorrencia.bind(_sb.recorrencias),
  },

  // integracoes — HTTP /clientes/integracoes (parcial)
  integracoes: {
    /** HTTP GET /clientes/integracoes/:id/api-key — revela chave de integração. */
    revelarChave: async (integracaoId: string): Promise<Ret<typeof _sb.integracoes.revelarChave>> => {
      try { return await http.get(`/clientes/integracoes/${integracaoId}/api-key`); }
      catch { return _sb.integracoes.revelarChave(integracaoId); }
    },
    /** @fallback tabela cliente_integracoes — sem endpoint NestJS completo. */
    getByCliente: _sb.integracoes.getByCliente.bind(_sb.integracoes),
    upsert: _sb.integracoes.upsert.bind(_sb.integracoes),
    updateMeta: _sb.integracoes.updateMeta.bind(_sb.integracoes),
    testarConexao: _sb.integracoes.testarConexao.bind(_sb.integracoes),
  },

  // ── Audit / Logs ──────────────────────────────────────────────────────────

  // auditLog — @fallback tabela audit_log — sem endpoint NestJS
  auditLog: {
    list: _sb.auditLog.list.bind(_sb.auditLog),
  },

  // alertasRetorno — @fallback tabela alerta_retorno_imovel — sem endpoint NestJS
  alertasRetorno: {
    listByAgente: _sb.alertasRetorno.listByAgente.bind(_sb.alertasRetorno),
    resolver: _sb.alertasRetorno.resolver.bind(_sb.alertasRetorno),
  },

  // historicoAtendimento — @fallback view v_historico_atendimento_local — sem endpoint NestJS
  historicoAtendimento: {
    listByClienteELocalizacao: _sb.historicoAtendimento.listByClienteELocalizacao.bind(_sb.historicoAtendimento),
    listByCliente: _sb.historicoAtendimento.listByCliente.bind(_sb.historicoAtendimento),
  },

  // ── Analista Regional ──────────────────────────────────────────────────────

  // agrupamentos — @fallback tabela agrupamento_regional — sem endpoint NestJS
  agrupamentos: {
    list: _sb.agrupamentos.list.bind(_sb.agrupamentos),
    create: _sb.agrupamentos.create.bind(_sb.agrupamentos),
    update: _sb.agrupamentos.update.bind(_sb.agrupamentos),
    listClientes: _sb.agrupamentos.listClientes.bind(_sb.agrupamentos),
    addCliente: _sb.agrupamentos.addCliente.bind(_sb.agrupamentos),
    removeCliente: _sb.agrupamentos.removeCliente.bind(_sb.agrupamentos),
  },

  // ── Piloto (Observabilidade Operacional) ───────────────────────────────────

  // piloto — @fallback views v_piloto_* — sem endpoint NestJS
  piloto: {
    getFunilHoje: _sb.piloto.getFunilHoje.bind(_sb.piloto),
    getDespachosSupervisor: _sb.piloto.getDespachosSupervisor.bind(_sb.piloto),
    getProdAgentes: _sb.piloto.getProdAgentes.bind(_sb.piloto),
  },
};
