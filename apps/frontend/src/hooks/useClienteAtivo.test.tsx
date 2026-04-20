/**
 * Testes do useClienteAtivo
 *
 * Hook central de multitenancy: fornece clienteId, clientes, tenantStatus.
 * Admin pode trocar de cliente; não-admin usa o cliente do próprio perfil.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const { mockClientesMe, mockClientesList } = vi.hoisted(() => ({
  mockClientesMe: vi.fn(),
  mockClientesList: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/services/api', () => ({
  api: {
    clientes: { me: mockClientesMe, list: mockClientesList },
  },
}));

import { useAuth } from '@/hooks/useAuth';
import { ClienteAtivoProvider, useClienteAtivo } from '@/hooks/useClienteAtivo';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const tenantOk = {
  status: 'ativo',
  plano_nome: 'profissional',
  is_blocked: false,
  is_inadimplente: false,
  is_trialing: false,
  trial_days_left: null,
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <ClienteAtivoProvider>{children}</ClienteAtivoProvider>;
}

describe('useClienteAtivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockClientesMe.mockResolvedValue({ id: 'cliente-1', nome: 'Prefeitura Test' });
    mockClientesList.mockResolvedValue([{ id: 'cliente-1', nome: 'Prefeitura Test' }]);
  });

  // ── Usuário não-admin ─────────────────────────────────────────────────────
  it('retorna o clienteId do próprio usuário para não-admin', async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: false,
      loading: false,
      usuario: { clienteId: 'cliente-1', agrupamentoId: null },
    });

    const { result } = renderHook(() => useClienteAtivo(), { wrapper });

    await waitFor(() => expect(result.current.clienteId).toBe('cliente-1'));
  });

  it('retorna null quando usuário não tem clienteId', async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: false,
      loading: false,
      usuario: { clienteId: null, agrupamentoId: null },
    });

    const { result } = renderHook(() => useClienteAtivo(), { wrapper });

    await waitFor(() => expect(result.current.clienteId).toBeNull());
  });

  // ── Admin pode trocar de cliente ──────────────────────────────────────────
  it('admin começa com clienteId null quando não há seleção prévia', async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      usuario: { clienteId: null, agrupamentoId: null },
    });

    const { result } = renderHook(() => useClienteAtivo(), { wrapper });

    // Sem seleção prévia no localStorage, clienteId começa null
    await waitFor(() => expect(result.current.clienteId).toBeNull());
  });

  it('admin pode definir um cliente via setClienteId', async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      usuario: { clienteId: null, agrupamentoId: null },
    });

    const { result } = renderHook(() => useClienteAtivo(), { wrapper });

    act(() => { result.current.setClienteId('cliente-2'); });

    await waitFor(() => expect(result.current.clienteId).toBe('cliente-2'));
  });

  // ── tenantStatus ──────────────────────────────────────────────────────────
  it('tenantStatus é preenchido após carregar quando clienteId é válido', async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: false,
      loading: false,
      usuario: { clienteId: 'cliente-1', agrupamentoId: null },
    });

    const { result } = renderHook(() => useClienteAtivo(), { wrapper });

    await waitFor(() => expect(result.current.tenantStatus).not.toBeNull());
  });

  it('tenantStatus permanece null quando clienteId é null', async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: false,
      loading: false,
      usuario: { clienteId: null, agrupamentoId: null },
    });

    const { result } = renderHook(() => useClienteAtivo(), { wrapper });

    await act(async () => { await Promise.resolve(); });
    expect(result.current.tenantStatus).toBeNull();
  });

  // ── Persistência em localStorage ──────────────────────────────────────────
  it('admin persiste clienteId selecionado no localStorage', async () => {
    mockUseAuth.mockReturnValue({
      isAdmin: true,
      loading: false,
      usuario: { clienteId: null, agrupamentoId: null },
    });

    const { result } = renderHook(() => useClienteAtivo(), { wrapper });

    act(() => { result.current.setClienteId('cliente-persistido'); });

    await waitFor(() => expect(result.current.clienteId).toBe('cliente-persistido'));
    const stored = Object.values(localStorage).find(v => v === 'cliente-persistido');
    expect(stored).toBe('cliente-persistido');
  });
});
