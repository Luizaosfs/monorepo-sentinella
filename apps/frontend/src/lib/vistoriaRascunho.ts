/**
 * vistoriaRascunho — autosave de rascunho de vistoria no IndexedDB.
 *
 * Store: 'drafts' no banco 'sentinela-offline' (v3, compartilhado com offlineQueue).
 * Chave: `${imovelId}_${agenteId}` — escopo por agente + imóvel.
 *
 * API assíncrona:
 *   salvarRascunho(rascunho)              → persiste no IndexedDB
 *   carregarRascunho(id, agente)          → retorna rascunho ou null
 *   carregarRascunhoExiste(id, agente)    → boolean
 *   limparRascunho(id, agente)            → remove do IndexedDB
 *
 * Migração automática: rascunhos existentes no localStorage são migrados
 * para IndexedDB na primeira leitura e removidos do localStorage.
 */

import type { TipoAtividade } from '@/types/database';
import type { EtapaPreData } from '@/components/vistoria/VistoriaEtapaPre';
import type { Etapa1Data } from '@/components/vistoria/VistoriaEtapa1Responsavel';
import type { Etapa2Data } from '@/components/vistoria/VistoriaEtapa2Sintomas';
import type { Etapa3Data } from '@/components/vistoria/VistoriaEtapa3Inspecao';
import type { Etapa4Data } from '@/components/vistoria/VistoriaEtapa4Tratamento';
import type { Etapa5Data } from '@/components/vistoria/VistoriaEtapa5Riscos';

export interface VistoriaRascunho {
  imovelId: string;
  agenteId: string;
  clienteId?: string;
  atividade: TipoAtividade;
  /** Estado de progresso do rascunho. */
  status?: 'em_andamento' | 'pendente_sync';
  etapa: number;
  etapaPre: EtapaPreData;
  etapa1: Etapa1Data;
  etapa2: Etapa2Data;
  etapa3: Etapa3Data;
  etapa4: Etapa4Data;
  etapa5: Etapa5Data;
  savedAt: string; // ISO 8601
}

// ── IndexedDB config (compartilhado com offlineQueue.ts) ──────────────────────
const DB_NAME      = 'sentinela-offline';
const DRAFTS_STORE = 'drafts';
const VERSION      = 4;

function getDraftKey(imovelId: string, agenteId: string): string {
  return `${imovelId}_${agenteId}`;
}

/** Chave legada do localStorage (usada apenas para migração). */
function getLegacyKey(imovelId: string, agenteId: string): string {
  return `vistoria_rascunho_${imovelId}_${agenteId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // store de operações (existente desde v1)
      if (!db.objectStoreNames.contains('operations')) {
        const store = db.createObjectStore('operations', { keyPath: 'id' });
        store.createIndex('por_createdAt', 'createdAt', { unique: false });
      } else if (event.oldVersion < 2) {
        const tx = (event.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore('operations');
        if (!store.indexNames.contains('por_createdAt')) {
          store.createIndex('por_createdAt', 'createdAt', { unique: false });
        }
      }
      // store de rascunhos (v3)
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'key' });
      }
      // v4: store de blobs de evidências pendentes
      if (!db.objectStoreNames.contains('evidencias_pendentes')) {
        db.createObjectStore('evidencias_pendentes', { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Migração silenciosa localStorage → IndexedDB ──────────────────────────────
async function migrarDoLocalStorage(imovelId: string, agenteId: string): Promise<void> {
  try {
    const legacyKey = getLegacyKey(imovelId, agenteId);
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as VistoriaRascunho;
    await salvarRascunho(parsed);          // grava no IndexedDB
    localStorage.removeItem(legacyKey);   // limpa o localStorage
  } catch {
    // silencioso — falha de migração não bloqueia
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function salvarRascunho(rascunho: VistoriaRascunho): Promise<void> {
  try {
    const db    = await openDb();
    const entry = { key: getDraftKey(rascunho.imovelId, rascunho.agenteId), ...rascunho };
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(DRAFTS_STORE, 'readwrite');
      const req = tx.objectStore(DRAFTS_STORE).put(entry);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch {
    // Fallback para localStorage se IndexedDB indisponível (ex: modo privado Safari)
    try {
      localStorage.setItem(
        getLegacyKey(rascunho.imovelId, rascunho.agenteId),
        JSON.stringify(rascunho),
      );
    } catch { /* ignorar */ }
  }
}

export async function carregarRascunho(
  imovelId: string,
  agenteId: string,
): Promise<VistoriaRascunho | null> {
  // Migra dado legado do localStorage antes de ler
  await migrarDoLocalStorage(imovelId, agenteId);

  try {
    const db  = await openDb();
    const key = getDraftKey(imovelId, agenteId);
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(DRAFTS_STORE, 'readonly');
      const req = tx.objectStore(DRAFTS_STORE).get(key);
      req.onsuccess = () => {
        const result = req.result as (VistoriaRascunho & { key: string }) | undefined;
        if (!result) { resolve(null); return; }
        if (
          result.imovelId !== imovelId ||
          result.agenteId !== agenteId ||
          typeof result.etapa !== 'number' ||
          !result.savedAt
        ) { resolve(null); return; }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { key: _k, ...rascunho } = result;
        resolve(rascunho);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback localStorage
    try {
      const raw = localStorage.getItem(getLegacyKey(imovelId, agenteId));
      if (!raw) return null;
      return JSON.parse(raw) as VistoriaRascunho;
    } catch { return null; }
  }
}

export async function carregarRascunhoExiste(
  imovelId: string,
  agenteId: string,
): Promise<boolean> {
  try {
    const db  = await openDb();
    const key = getDraftKey(imovelId, agenteId);
    const idb: boolean = await new Promise((resolve) => {
      const tx  = db.transaction(DRAFTS_STORE, 'readonly');
      const req = tx.objectStore(DRAFTS_STORE).count(key);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror   = () => resolve(false);
    });
    if (idb) return true;
  } catch { /* continua para fallback */ }
  // Fallback: verifica localStorage legado
  return localStorage.getItem(getLegacyKey(imovelId, agenteId)) !== null;
}

export async function limparRascunho(imovelId: string, agenteId: string): Promise<void> {
  try {
    const db  = await openDb();
    const key = getDraftKey(imovelId, agenteId);
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(DRAFTS_STORE, 'readwrite');
      const req = tx.objectStore(DRAFTS_STORE).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch { /* ignorar */ }
  // Limpa também o localStorage legado
  try { localStorage.removeItem(getLegacyKey(imovelId, agenteId)); } catch { /* ignorar */ }
}

/**
 * Salva SINCRONAMENTE no localStorage — usar APENAS no handler de pagehide/visibilitychange,
 * onde o IndexedDB (async) pode não concluir antes do browser encerrar a página.
 * Em todos os outros casos, usar `salvarRascunho` (async, IndexedDB).
 */
export function salvarRascunhoEmergencia(rascunho: VistoriaRascunho): void {
  try {
    localStorage.setItem(getLegacyKey(rascunho.imovelId, rascunho.agenteId), JSON.stringify(rascunho));
  } catch { /* ignorar */ }
}

/** Retorna string legível do tempo decorrido desde o salvamento (ex: "há 5 min"). */
export function formatarTempoRascunho(savedAt: string): string {
  const diff = Date.now() - new Date(savedAt).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)  return 'há poucos segundos';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `há ${h}h`;
  return `há ${Math.floor(h / 24)} dia(s)`;
}
