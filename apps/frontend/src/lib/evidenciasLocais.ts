/**
 * evidenciasLocais — armazenamento de blobs de evidências PNCD no IndexedDB.
 *
 * Store: 'evidencias_pendentes' no banco 'sentinela-offline' (v4, compartilhado com offlineQueue e vistoriaRascunho).
 * Chave: localId (UUID gerado no frontend na captura).
 *
 * Fluxo offline:
 *   1. Foto capturada → comprimida → blob salvo aqui via salvarEvidenciaLocal()
 *   2. Preview: URL.createObjectURL(entry.blob) — efêmero, nunca persistido
 *   3. Ao sincronizar (drainQueue Phase A): carregarEvidenciaLocal() → base64 → invokeUploadEvidencia()
 *   4. Após upload OK: removerEvidenciaLocal()
 */

const DB_NAME = 'sentinela-offline';
const STORE   = 'evidencias_pendentes';
const VERSION = 4;

export interface EvidenciaLocalEntry {
  localId: string;
  depositoTipo: string;
  tipoImagem: 'antes' | 'depois';
  mimeType: string;
  tamanhoBytes: number;
  criadaEm: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
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
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function salvarEvidenciaLocal(entry: EvidenciaLocalEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function carregarEvidenciaLocal(localId: string): Promise<EvidenciaLocalEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(localId);
    req.onsuccess = () => resolve((req.result as EvidenciaLocalEntry) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function removerEvidenciaLocal(localId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(localId);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
