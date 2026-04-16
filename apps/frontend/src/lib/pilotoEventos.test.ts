import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted garante que as fns existem quando vi.mock() (hoisted) executa
const { mockInsertThen, mockInsert, mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockInsertThen: vi.fn(),
  mockInsert: vi.fn(() => ({ then: vi.fn() })),
  mockFrom: vi.fn(() => ({ insert: vi.fn(() => ({ then: vi.fn() })) })),
  mockGetUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-123' } } })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

import { logEvento } from './pilotoEventos';

describe('logEvento — fire-and-forget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ then: mockInsertThen });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
  });

  // ── Não lança ─────────────────────────────────────────────────────────────
  it('não lança exceção com payload válido', () => {
    expect(() =>
      logEvento('foco_visualizado', 'cliente-abc', { foco_id: 'foco-1' })
    ).not.toThrow();
  });

  it('não lança exceção com clienteId null', () => {
    expect(() => logEvento('foco_visualizado', null)).not.toThrow();
  });

  it('não lança exceção com clienteId undefined', () => {
    expect(() => logEvento('foco_visualizado', undefined)).not.toThrow();
  });

  it('não lança exceção sem payload', () => {
    expect(() => logEvento('dashboard_aberto', 'cliente-abc')).not.toThrow();
  });

  // ── Retorno void ──────────────────────────────────────────────────────────
  it('retorna undefined (fire-and-forget)', () => {
    const result = logEvento('rota_otimizada', 'cliente-xyz');
    expect(result).toBeUndefined();
  });

  // ── Guarda de clienteId nulo ──────────────────────────────────────────────
  it('não chama supabase quando clienteId é null', () => {
    logEvento('foco_visualizado', null);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('não chama supabase quando clienteId é undefined', () => {
    logEvento('foco_visualizado', undefined);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('não chama supabase quando clienteId é string vazia', () => {
    logEvento('foco_visualizado', '');
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  // ── Com clienteId válido chama supabase ───────────────────────────────────
  it('chama supabase.auth.getUser quando clienteId é válido', async () => {
    logEvento('triagem_aberta', 'cliente-abc');
    await Promise.resolve();
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  // ── Silencia erros internos ───────────────────────────────────────────────
  it('não propaga erros internos do supabase.auth.getUser', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('network error'));
    expect(() => logEvento('dashboard_aberto', 'cliente-abc')).not.toThrow();
    await Promise.resolve();
  });

  // ── Tipos de evento ───────────────────────────────────────────────────────
  it('aceita o evento despacho_lote', () => {
    expect(() =>
      logEvento('despacho_lote', 'cliente-abc', { quantidade: 5 })
    ).not.toThrow();
  });
});
