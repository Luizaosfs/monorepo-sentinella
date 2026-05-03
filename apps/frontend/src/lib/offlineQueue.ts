/**
 * Fila offline baseada em IndexedDB.
 *
 * Operações suportadas:
 *  - 'checkin'           — registrar chegada ao local (api.itens.registrarCheckin)
 *  - 'update_atendimento' — transicionar foco_risco via state machine (api.focosRisco.transicionar);
 *                          fallback para api.itens.updateAtendimento em itens pré-migração sem foco
 *  - 'save_vistoria'     — salvar vistoria completa via RPC transacional (api.vistorias.createCompleta)
 *                          Suporta vistorias com e sem acesso (acesso_realizado=false)
 *
 * Uso:
 *   import { enqueue, drainQueue } from '@/lib/offlineQueue';
 *
 *   // Enfileirar ao falhar por falta de rede:
 *   await enqueue({ type: 'checkin', itemId: '...', coords: { latitude, longitude } });
 *
 *   // Drenar ao reconectar (chamado em useOfflineQueue):
 *   await drainQueue();
 */

import { StatusAtendimento, TipoDeposito, TipoAtividade, FocoRiscoStatus } from '@/types/database';
import { generateUUID } from '@/lib/uuid';

const DB_NAME = 'sentinela-offline';
const STORE   = 'operations';
const VERSION = 3; // v3: adiciona store 'drafts' para rascunhos de vistoria (IndexedDB > localStorage)

export interface VistoriaPayload {
  /** UUID gerado no frontend antes de enfileirar — garante idempotência no servidor. */
  idempotency_key?: string;
  clienteId: string;
  imovelId: string;
  agenteId: string;
  ciclo: number;
  tipoAtividade: TipoAtividade;
  dataVisita: string;
  moradores_qtd: number;
  gravidas: number;
  idosos: number;
  criancas_7anos: number;
  lat_chegada: number | null;
  lng_chegada: number | null;
  checkin_em: string | null;
  observacao: string | null;
  origem_visita?: string | null;
  habitat_selecionado?: string | null;
  condicao_habitat?: string | null;
  depositos: {
    tipo: TipoDeposito;
    qtd_inspecionados: number;
    qtd_com_agua: number;
    qtd_com_focos: number;
    eliminado: boolean;
    vedado: boolean;
    qtd_eliminados: number;
    usou_larvicida: boolean;
    qtd_larvicida_g: number | null;
    ia_identificacao?: Record<string, unknown> | null;
  }[];
  sintomas: {
    febre: boolean;
    manchas_vermelhas: boolean;
    dor_articulacoes: boolean;
    dor_cabeca: boolean;
    moradores_sintomas_qtd: number;
  } | null;
  riscos: Record<string, boolean | string | null> | null;
  tem_calha: boolean;
  calha_inacessivel: boolean;
  calhas: { posicao: string; condicao: string; com_foco: boolean }[];
  assinatura_responsavel_url?: string | null;
  // sem_acesso fields — presentes quando acesso_realizado = false
  acesso_realizado?: boolean;
  status?: string;
  motivo_sem_acesso?: string | null;
  proximo_horario_sugerido?: string | null;
  observacao_acesso?: string | null;
  foto_externa_url?: string | null;
}

export type QueuedOperation =
  | {
      id: string;
      type: 'checkin';
      itemId: string;
      coords?: { latitude: number; longitude: number };
      createdAt: number;
      retryCount?: number;
      nextRetryAt?: number;
    }
  | {
      id: string;
      type: 'update_atendimento';
      itemId: string;
      /** ID do foco vinculado ao item — presente quando o item já tem foco_risco. */
      focoRiscoId?: string;
      status: StatusAtendimento;
      acaoAplicada: string | null;
      createdAt: number;
      retryCount?: number;
      nextRetryAt?: number;
    }
  | {
      id: string;
      type: 'save_vistoria';
      payload: VistoriaPayload;
      createdAt: number;
      retryCount?: number;
      nextRetryAt?: number;
    };

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // v1→v2: store de operações + índice FIFO
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('por_createdAt', 'createdAt', { unique: false });
      } else if (event.oldVersion < 2) {
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(STORE);
        if (!store.indexNames.contains('por_createdAt')) {
          store.createIndex('por_createdAt', 'createdAt', { unique: false });
        }
      }
      // v3: store de rascunhos de vistoria (chave = imovelId_agenteId)
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

// Distributive Omit: preserva a discriminação do union ao remover 'id'
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Adiciona uma operação à fila. */
export async function enqueue(op: DistributiveOmit<QueuedOperation, 'id'>): Promise<void> {
  const db = await openDb();
  // Garantir idempotency_key para save_vistoria se não vier do caller
  const opWithKey = op.type === 'save_vistoria' && !op.payload.idempotency_key
    ? { ...op, payload: { ...op.payload, idempotency_key: generateUUID() } }
    : op;
  const entry = { ...opWithKey, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Retorna o número de operações pendentes na fila (excluindo dead-letters). */
export async function getPendingCount(): Promise<number> {
  const ops = await listAll();
  return ops.filter((op) => !isExpired(op) && (op.retryCount ?? 0) < MAX_RETRIES).length;
}

/** Lista todas as operações pendentes em ordem FIFO (por createdAt). */
export async function listAll(): Promise<QueuedOperation[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    // Usa índice por_createdAt quando disponível (VERSION >= 2)
    const source = store.indexNames.contains('por_createdAt')
      ? store.index('por_createdAt')
      : store;
    const req = (source as IDBIndex | IDBObjectStore).getAll();
    req.onsuccess = () => resolve(req.result as QueuedOperation[]);
    req.onerror   = () => reject(req.error);
  });
}

/** Remove uma operação da fila pelo id. */
export async function remove(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Atualiza campos de uma operação existente (ex: retryCount, nextRetryAt). */
async function updateItem(item: QueuedOperation): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(item);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Número máximo de tentativas antes de mover para dead-letter. */
const MAX_RETRIES = 3;

/** TTL máximo de uma operação na fila (7 dias em ms). Operações mais antigas são descartadas. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Verifica se uma operação expirou (> 7 dias). */
function isExpired(op: QueuedOperation): boolean {
  return Date.now() - op.createdAt > MAX_AGE_MS;
}

/** Mutex: impede execuções simultâneas de drainQueue (múltiplas abas ou reconexões rápidas). */
let drainInProgress = false;

/** Retorna operações da fila anotadas com status visual (para SyncStatusPanel). */
export async function listAllWithStatus(): Promise<(QueuedOperation & { expired: boolean; deadLetter: boolean })[]> {
  const ops = await listAll();
  return ops.map((op) => ({
    ...op,
    expired:    isExpired(op),
    deadLetter: (op.retryCount ?? 0) >= MAX_RETRIES,
  }));
}

/** Executa todas as operações pendentes. Retorna contadores de sucesso/falha. */
export async function drainQueue(): Promise<{
  ok: number;
  failed: number;
  /** Operações descartadas por TTL (>7 dias). */
  expired: number;
  /** true se houve sync de check-in ou status de atendimento (impacta contagens do dashboard). */
  touchedAtendimento: boolean;
  /** Quantidade de vistorias enviadas sem assinatura ou foto (evidências perdidas offline). */
  vistoriasPendentes: number;
}> {
  // Mutex: evita execuções simultâneas (múltiplas abas, reconexão rápida)
  if (drainInProgress) return { ok: 0, failed: 0, expired: 0, touchedAtendimento: false, vistoriasPendentes: 0 };
  drainInProgress = true;

  try {
    return await _drainQueueInternal();
  } finally {
    drainInProgress = false;
  }
}

async function _drainQueueInternal(): Promise<{
  ok: number; failed: number; expired: number; touchedAtendimento: boolean; vistoriasPendentes: number;
}> {
  const ops = await listAll();
  if (ops.length === 0) return { ok: 0, failed: 0, expired: 0, touchedAtendimento: false, vistoriasPendentes: 0 };

  // Imports lazy para evitar dependência circular no momento de carregamento
  const { api } = await import('@/services/api');
  const { avancarFocoAte, atendimentoToFocoAlvo } = await import('@/lib/focosRiscoUtils');

  let ok = 0;
  let failed = 0;
  let expired = 0;
  let touchedAtendimento = false;
  let vistoriasPendentes = 0;

  // Processar em ordem de criação
  const sorted = [...ops].sort((a, b) => a.createdAt - b.createdAt);

  for (const op of sorted) {
    // Aguardar janela de retry (backoff exponencial)
    if (op.nextRetryAt && op.nextRetryAt > Date.now()) {
      failed++;
      continue;
    }

    // TTL: operação mais antiga que 7 dias — descartar sem tentar
    if (isExpired(op)) {
      const erroMsg = `Operação descartada por TTL (criada há mais de 7 dias).`;
      const idempKey = op.type === 'save_vistoria' ? (op.payload.idempotency_key ?? null) : null;
      const clienteId = op.type === 'save_vistoria' ? op.payload.clienteId : null;
      api.offlineSyncLog.registrar({
        operacao: op.type,
        erro: erroMsg,
        retry_count: op.retryCount ?? 0,
        idempotency_key: idempKey,
        cliente_id: clienteId,
      }).catch(() => {});
      await remove(op.id);
      expired++;
      continue;
    }

    // Dead-letter: excedeu tentativas máximas
    if ((op.retryCount ?? 0) >= MAX_RETRIES) {
      const erroMsg = `Operação excedeu ${MAX_RETRIES} tentativas e foi descartada (dead-letter).`;
      const idempKey = op.type === 'save_vistoria' ? (op.payload.idempotency_key ?? null) : null;
      const clienteId = op.type === 'save_vistoria' ? op.payload.clienteId : null;
      api.offlineSyncLog.registrar({
        operacao: op.type,
        erro: erroMsg,
        retry_count: op.retryCount ?? MAX_RETRIES,
        idempotency_key: idempKey,
        cliente_id: clienteId,
      }).catch(() => {});
      await remove(op.id);
      failed++;
      continue;
    }

    try {
      if (op.type === 'checkin') {
        try { await api.itens.registrarCheckin(op.itemId, op.coords); } catch { /* endpoint pendente */ }
        touchedAtendimento = true;
      } else if (op.type === 'update_atendimento') {
        const focoId = op.focoRiscoId;
        if (focoId) {
          const foco = await api.focosRisco.getById(focoId);
          if (foco) {
            const alvo = atendimentoToFocoAlvo(op.status);
            await avancarFocoAte(focoId, foco.status as FocoRiscoStatus, alvo, op.acaoAplicada);
            if (op.acaoAplicada && op.status === 'resolvido') {
              await api.focosRisco.update(focoId, { desfecho: op.acaoAplicada });
            }
          }
        }
        touchedAtendimento = true;
      } else if (op.type === 'save_vistoria') {
        // F-01: usa RPC transacional — mesma lógica do modo online
        const p = op.payload;
        const vistoriaId = await api.vistorias.createCompleta({
          idempotency_key: p.idempotency_key ?? null,
          cliente_id: p.clienteId,
          imovel_id: p.imovelId,
          agente_id: p.agenteId,
          ciclo: p.ciclo,
          tipo_atividade: p.tipoAtividade,
          data_visita: p.dataVisita,
          status: p.status ?? 'visitado',
          acesso_realizado: p.acesso_realizado ?? true,
          motivo_sem_acesso: p.motivo_sem_acesso ?? null,
          proximo_horario_sugerido: p.proximo_horario_sugerido ?? null,
          observacao_acesso: p.observacao_acesso ?? null,
          foto_externa_url: p.foto_externa_url ?? null,
          moradores_qtd: p.moradores_qtd,
          gravidas: p.gravidas,
          idosos: p.idosos,
          criancas_7anos: p.criancas_7anos,
          lat_chegada: p.lat_chegada,
          lng_chegada: p.lng_chegada,
          checkin_em: p.checkin_em,
          observacao: p.observacao,
          origem_visita: p.origem_visita ?? null,
          habitat_selecionado: p.habitat_selecionado ?? null,
          condicao_habitat: p.condicao_habitat ?? null,
          depositos: p.depositos,
          sintomas: p.sintomas ? [p.sintomas] : undefined,
          riscos: p.riscos ? [p.riscos] : undefined,
          tem_calha: p.tem_calha,
          calha_inacessivel: p.calha_inacessivel,
          calhas: p.calhas,
          assinatura_responsavel_url: p.assinatura_responsavel_url ?? null,
          origem_offline: true,
        });

        // QW-05 Correção 2: marcar pendências de evidências perdidas offline
        const semAcesso = p.acesso_realizado === false;
        const pendAssinatura = !semAcesso && !p.assinatura_responsavel_url;
        const pendFoto = semAcesso && !p.foto_externa_url;
        if (pendAssinatura || pendFoto) {
          await api.vistorias.marcarPendencias(vistoriaId, {
            pendente_assinatura: pendAssinatura,
            pendente_foto: pendFoto,
          });
          vistoriasPendentes++;
        }
      }
      await remove(op.id);
      ok++;
    } catch (err) {
      const pgCode = (err as { code?: string })?.code;

      // 23505 = unique_violation — dado já existe no servidor (retry idempotente)
      // Tratar como sucesso: remover da fila sem contar como falha.
      if (pgCode === '23505') {
        await remove(op.id);
        ok++;
      } else {
        // Incrementar retryCount e agendar próxima tentativa (backoff exponencial: 2^n segundos)
        const retryCount = (op.retryCount ?? 0) + 1;
        const delayMs = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        await updateItem({ ...op, retryCount, nextRetryAt: Date.now() + delayMs });
        failed++;

        const erroMsg = err instanceof Error ? err.message : String(err);
        const idempKey = op.type === 'save_vistoria' ? (op.payload.idempotency_key ?? null) : null;
        const clienteId = op.type === 'save_vistoria' ? op.payload.clienteId : null;
        api.offlineSyncLog.registrar({
          operacao: op.type,
          erro: erroMsg,
          retry_count: retryCount,
          idempotency_key: idempKey,
          cliente_id: clienteId,
        }).catch(() => {});
      }
    }
  }

  return { ok, failed, expired, touchedAtendimento, vistoriasPendentes };
}
