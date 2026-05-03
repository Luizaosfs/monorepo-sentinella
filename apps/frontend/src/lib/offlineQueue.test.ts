/**
 * Testes da fila offline (IndexedDB).
 *
 * Usa fake-indexeddb para substituir o global indexedDB em memória.
 * Cada teste recebe um banco limpo via beforeEach.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// ── Reset do IndexedDB antes de cada teste ────────────────────────────────────
// offlineQueue usa o global `indexedDB` diretamente — trocar por instância nova
// dá um banco vazio isolado por teste.
beforeEach(() => {
  // @ts-expect-error — sobrescrever global para testes
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Importação dinâmica para garantir que o módulo usa o indexedDB injetado acima.
// Como o módulo não cacheia a instância do DB, basta importar normalmente.
import {
  enqueue,
  listAll,
  remove,
  listAllWithStatus,
} from './offlineQueue';
import type { QueuedOperation, VistoriaPayload } from './offlineQueue';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCheckin(overrides: Partial<Omit<QueuedOperation & { type: 'checkin' }, 'id'>> = {}): Omit<QueuedOperation & { type: 'checkin' }, 'id'> {
  return {
    type: 'checkin',
    itemId: 'item-1',
    coords: { latitude: -23.5, longitude: -46.6 },
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeUpdateAtendimento(overrides = {}): Omit<QueuedOperation & { type: 'update_atendimento' }, 'id'> {
  return {
    type: 'update_atendimento',
    itemId: 'item-2',
    status: 'em_atendimento' as never,
    acaoAplicada: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

const BASE_VISTORIA_PAYLOAD: VistoriaPayload = {
  clienteId: 'cliente-1',
  imovelId: 'imovel-1',
  agenteId: 'agente-1',
  ciclo: 1,
  tipoAtividade: 'tratamento',
  dataVisita: '2026-04-02',
  moradores_qtd: 3,
  gravidas: 0,
  idosos: 0,
  criancas_7anos: 1,
  lat_chegada: -23.5,
  lng_chegada: -46.6,
  checkin_em: '2026-04-02T08:00:00Z',
  observacao: null,
  depositos: [],
  sintomas: null,
  riscos: null,
  tem_calha: false,
  calha_inacessivel: false,
  calhas: [],
};

function makeSaveVistoria(payloadOverrides: Partial<VistoriaPayload> = {}): Omit<QueuedOperation & { type: 'save_vistoria' }, 'id'> {
  return {
    type: 'save_vistoria',
    payload: { ...BASE_VISTORIA_PAYLOAD, ...payloadOverrides },
    createdAt: Date.now(),
  };
}

// ── enqueue + listAll ─────────────────────────────────────────────────────────

describe('enqueue / listAll', () => {
  it('fila vazia retorna array vazio', async () => {
    const ops = await listAll();
    expect(ops).toEqual([]);
  });

  it('enqueue adiciona checkin e listAll o retorna', async () => {
    await enqueue(makeCheckin());
    const ops = await listAll();
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('checkin');
  });

  it('enqueue adiciona update_atendimento corretamente', async () => {
    await enqueue(makeUpdateAtendimento());
    const ops = await listAll();
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('update_atendimento');
  });

  it('enqueue gera id único para cada operação', async () => {
    await enqueue(makeCheckin());
    await enqueue(makeCheckin());
    const ops = await listAll();
    expect(ops).toHaveLength(2);
    expect(ops[0].id).not.toBe(ops[1].id);
  });

  it('múltiplas operações de tipos diferentes coexistem', async () => {
    await enqueue(makeCheckin());
    await enqueue(makeUpdateAtendimento());
    await enqueue(makeSaveVistoria());
    const ops = await listAll();
    expect(ops).toHaveLength(3);
    const types = ops.map((o) => o.type);
    expect(types).toContain('checkin');
    expect(types).toContain('update_atendimento');
    expect(types).toContain('save_vistoria');
  });
});

// ── idempotency_key para save_vistoria ────────────────────────────────────────

describe('enqueue save_vistoria — idempotency_key', () => {
  it('gera idempotency_key automaticamente quando ausente', async () => {
    await enqueue(makeSaveVistoria()); // sem idempotency_key
    const ops = await listAll();
    const op = ops[0] as QueuedOperation & { type: 'save_vistoria' };
    expect(op.payload.idempotency_key).toBeDefined();
    expect(typeof op.payload.idempotency_key).toBe('string');
    expect(op.payload.idempotency_key!.length).toBeGreaterThan(0);
  });

  it('preserva idempotency_key quando já fornecida', async () => {
    const KEY = 'minha-chave-idempotente-123';
    await enqueue(makeSaveVistoria({ idempotency_key: KEY }));
    const ops = await listAll();
    const op = ops[0] as QueuedOperation & { type: 'save_vistoria' };
    expect(op.payload.idempotency_key).toBe(KEY);
  });

  it('checkin não recebe idempotency_key', async () => {
    await enqueue(makeCheckin());
    const ops = await listAll();
    expect(ops[0]).not.toHaveProperty('idempotency_key');
  });
});

// ── remove ────────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('remove a operação pelo id', async () => {
    await enqueue(makeCheckin());
    const [op] = await listAll();
    await remove(op.id);
    expect(await listAll()).toHaveLength(0);
  });

  it('remove apenas a operação alvo, mantendo as demais', async () => {
    await enqueue(makeCheckin({ itemId: 'item-A' }));
    await enqueue(makeCheckin({ itemId: 'item-B' }));
    const ops = await listAll();
    expect(ops).toHaveLength(2);

    await remove(ops[0].id);
    const remaining = await listAll();
    expect(remaining).toHaveLength(1);
  });

  it('remove com id inexistente não lança erro', async () => {
    await expect(remove('id-que-nao-existe')).resolves.toBeUndefined();
  });
});

// ── listAll — ordenação FIFO ───────────────────────────────────────────────────

describe('listAll — ordenação por createdAt (FIFO)', () => {
  it('retorna operações em ordem crescente de createdAt', async () => {
    const now = Date.now();
    await enqueue(makeCheckin({ itemId: 'primeiro', createdAt: now }));
    await enqueue(makeCheckin({ itemId: 'segundo',  createdAt: now + 100 }));
    await enqueue(makeCheckin({ itemId: 'terceiro', createdAt: now + 200 }));

    const ops = await listAll();
    expect(ops).toHaveLength(3);
    // Garantir ordenação (índice por_createdAt)
    const criados = ops.map((o) => o.createdAt);
    expect(criados[0]).toBeLessThanOrEqual(criados[1]);
    expect(criados[1]).toBeLessThanOrEqual(criados[2]);
  });
});

// ── listAllWithStatus — expired / deadLetter ──────────────────────────────────

describe('listAllWithStatus', () => {
  it('operação recente não é expired nem deadLetter', async () => {
    await enqueue(makeCheckin());
    const [op] = await listAllWithStatus();
    expect(op.expired).toBe(false);
    expect(op.deadLetter).toBe(false);
  });

  it('operação com createdAt > 7 dias é marcada como expired', async () => {
    const OITO_DIAS_MS = 8 * 24 * 60 * 60 * 1000;
    await enqueue(makeCheckin({ createdAt: Date.now() - OITO_DIAS_MS }));
    const [op] = await listAllWithStatus();
    expect(op.expired).toBe(true);
  });

  it('operação com retryCount >= 3 é marcada como deadLetter', async () => {
    await enqueue(makeCheckin({ retryCount: 3 }));
    const [op] = await listAllWithStatus();
    expect(op.deadLetter).toBe(true);
  });

  it('operação com retryCount = 2 ainda não é deadLetter', async () => {
    await enqueue(makeCheckin({ retryCount: 2 }));
    const [op] = await listAllWithStatus();
    expect(op.deadLetter).toBe(false);
  });

  it('operação sem retryCount não é deadLetter', async () => {
    await enqueue(makeCheckin()); // retryCount ausente
    const [op] = await listAllWithStatus();
    expect(op.deadLetter).toBe(false);
  });

  it('inclui campos originais da operação', async () => {
    await enqueue(makeCheckin({ itemId: 'x1' }));
    const [op] = await listAllWithStatus();
    const checkin = op as typeof op & { itemId: string };
    expect(checkin.itemId).toBe('x1');
    expect(op.type).toBe('checkin');
  });
});

// ── save_vistoria sem acesso ──────────────────────────────────────────────────

describe('save_vistoria — campos sem acesso', () => {
  it('payload sem acesso preserva motivo_sem_acesso', async () => {
    await enqueue(makeSaveVistoria({
      acesso_realizado: false,
      status: 'revisita',
      motivo_sem_acesso: 'fechado_ausente',
      proximo_horario_sugerido: 'manha',
    }));
    const ops = await listAll();
    const op = ops[0] as QueuedOperation & { type: 'save_vistoria' };
    expect(op.payload.acesso_realizado).toBe(false);
    expect(op.payload.motivo_sem_acesso).toBe('fechado_ausente');
    expect(op.payload.proximo_horario_sugerido).toBe('manha');
  });
});
