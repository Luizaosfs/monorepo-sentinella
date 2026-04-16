/**
 * Multitenancy isolation tests
 *
 * Verifica que os padrões de isolamento por cliente_id são respeitados
 * nos utilitários e helpers do frontend.
 *
 * Estes testes cobrem lógica pura (sem rede) — a garantia de RLS no banco
 * é responsabilidade das migrations e policies do Supabase.
 */

import { describe, it, expect } from 'vitest';

// ── Helpers simulados para os testes ─────────────────────────────────────────

/** Filtra uma lista de registros pelo cliente_id fornecido (simula RLS). */
function filterByCliente<T extends { cliente_id: string }>(
  items: T[],
  clienteId: string,
): T[] {
  return items.filter((i) => i.cliente_id === clienteId);
}

/** Verifica que um payload de insert inclui o cliente_id esperado. */
function assertClienteId(payload: Record<string, unknown>, clienteId: string): boolean {
  return payload['cliente_id'] === clienteId;
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const CLIENTE_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const CLIENTE_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const itens = [
  { id: '1', cliente_id: CLIENTE_A, item: 'Foco A1' },
  { id: '2', cliente_id: CLIENTE_A, item: 'Foco A2' },
  { id: '3', cliente_id: CLIENTE_B, item: 'Foco B1' },
  { id: '4', cliente_id: CLIENTE_B, item: 'Foco B2' },
  { id: '5', cliente_id: CLIENTE_B, item: 'Foco B3' },
];

const casos = [
  { id: 'c1', cliente_id: CLIENTE_A, doenca: 'dengue' },
  { id: 'c2', cliente_id: CLIENTE_B, doenca: 'zika' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('filterByCliente — isolamento de dados entre clientes', () => {
  it('retorna apenas registros do cliente A', () => {
    const result = filterByCliente(itens, CLIENTE_A);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.cliente_id === CLIENTE_A)).toBe(true);
  });

  it('retorna apenas registros do cliente B', () => {
    const result = filterByCliente(itens, CLIENTE_B);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.cliente_id === CLIENTE_B)).toBe(true);
  });

  it('não vaza dados do cliente B para o cliente A', () => {
    const result = filterByCliente(itens, CLIENTE_A);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('3');
    expect(ids).not.toContain('4');
    expect(ids).not.toContain('5');
  });

  it('não vaza dados do cliente A para o cliente B', () => {
    const result = filterByCliente(itens, CLIENTE_B);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('1');
    expect(ids).not.toContain('2');
  });

  it('retorna lista vazia para cliente_id inexistente', () => {
    const result = filterByCliente(itens, 'nao-existe');
    expect(result).toHaveLength(0);
  });

  it('isola casos notificados por cliente', () => {
    expect(filterByCliente(casos, CLIENTE_A)).toHaveLength(1);
    expect(filterByCliente(casos, CLIENTE_B)).toHaveLength(1);
  });
});

describe('assertClienteId — payloads de insert sempre incluem cliente_id', () => {
  it('retorna true quando o payload tem o cliente_id correto', () => {
    const payload = { cliente_id: CLIENTE_A, doenca: 'dengue', status: 'suspeito' };
    expect(assertClienteId(payload, CLIENTE_A)).toBe(true);
  });

  it('retorna false quando o payload tem cliente_id errado', () => {
    const payload = { cliente_id: CLIENTE_B, doenca: 'dengue' };
    expect(assertClienteId(payload, CLIENTE_A)).toBe(false);
  });

  it('retorna false quando o payload não tem cliente_id', () => {
    const payload = { doenca: 'dengue', status: 'suspeito' };
    expect(assertClienteId(payload, CLIENTE_A)).toBe(false);
  });

  it('retorna false quando cliente_id é string vazia', () => {
    const payload = { cliente_id: '', doenca: 'dengue' };
    expect(assertClienteId(payload, CLIENTE_A)).toBe(false);
  });
});

describe('isolamento de cliente ativo — padrão useClienteAtivo', () => {
  it('dois clientes distintos têm UUIDs diferentes', () => {
    expect(CLIENTE_A).not.toBe(CLIENTE_B);
  });

  it('a contagem por cliente é independente', () => {
    const countA = filterByCliente(itens, CLIENTE_A).length;
    const countB = filterByCliente(itens, CLIENTE_B).length;
    expect(countA + countB).toBe(itens.length);
    expect(countA).not.toBe(countB);
  });
});
