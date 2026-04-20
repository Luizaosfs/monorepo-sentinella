import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@sentinella/api-client', () => ({
  http: { post: mockPost },
}));

import { logEvento } from './pilotoEventos';

describe('logEvento — fire-and-forget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({});
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
  it('não chama http quando clienteId é null', () => {
    logEvento('foco_visualizado', null);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('não chama http quando clienteId é undefined', () => {
    logEvento('foco_visualizado', undefined);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('não chama http quando clienteId é string vazia', () => {
    logEvento('foco_visualizado', '');
    expect(mockPost).not.toHaveBeenCalled();
  });

  // ── Com clienteId válido chama http.post ──────────────────────────────────
  it('chama supabase.auth.getUser quando clienteId é válido', async () => {
    logEvento('triagem_aberta', 'cliente-abc');
    await Promise.resolve();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  // ── Silencia erros internos ───────────────────────────────────────────────
  it('não propaga erros internos do supabase.auth.getUser', async () => {
    mockPost.mockRejectedValueOnce(new Error('network error'));
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
