import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockListByAgente = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockListByImovel = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGetResumo    = vi.hoisted(() => vi.fn().mockResolvedValue({ total: 0, visitados: 0, pendentes: 0 }));
const mockCreate       = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'v1' }));
const mockUpdateStatus = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/services/api', () => ({
  api: {
    vistorias: {
      listByAgente:  mockListByAgente,
      listByImovel:  mockListByImovel,
      getResumoAgente: mockGetResumo,
      create:        mockCreate,
      updateStatus:  mockUpdateStatus,
    },
  },
}));

vi.mock('@/hooks/useRealtimeInvalidator', () => ({
  useRealtimeInvalidator: vi.fn(),
}));

vi.mock('@/lib/quotaErrorHandler', () => ({
  handleQuotaError: vi.fn().mockReturnValue(false),
}));

import {
  useVistorias,
  useVistoriasByImovel,
  useVistoriaResumo,
  useCreateVistoriaMutation,
  useUpdateVistoriaStatusMutation,
} from './useVistorias';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// ── useVistorias ──────────────────────────────────────────────────────────────

describe('useVistorias', () => {
  beforeEach(() => { mockListByAgente.mockClear(); });

  it('não executa quando clienteId é null', async () => {
    renderHook(() => useVistorias(null, 'agente-1'), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockListByAgente).not.toHaveBeenCalled();
  });

  it('não executa quando agenteId é null', async () => {
    renderHook(() => useVistorias('cli-1', null), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockListByAgente).not.toHaveBeenCalled();
  });

  it('não executa quando ambos são null', async () => {
    renderHook(() => useVistorias(null, null), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockListByAgente).not.toHaveBeenCalled();
  });

  it('executa quando clienteId e agenteId estão presentes', async () => {
    const { result } = renderHook(() => useVistorias('cli-1', 'agente-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListByAgente).toHaveBeenCalledWith('cli-1', 'agente-1', undefined);
    expect(result.current.data).toEqual([]);
  });

  it('passa ciclo opcional para api.vistorias.listByAgente', async () => {
    renderHook(() => useVistorias('cli-1', 'agente-1', 3), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockListByAgente).toHaveBeenCalled());
    expect(mockListByAgente).toHaveBeenCalledWith('cli-1', 'agente-1', 3);
  });

  it('retorna vistorias da API', async () => {
    const vs = [{ id: 'v1', status: 'visitado' }, { id: 'v2', status: 'pendente' }];
    mockListByAgente.mockResolvedValueOnce(vs);
    const { result } = renderHook(() => useVistorias('cli-1', 'agente-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });
});

// ── useVistoriasByImovel ──────────────────────────────────────────────────────

describe('useVistoriasByImovel', () => {
  beforeEach(() => { mockListByImovel.mockClear(); });

  it('não executa quando imovelId é null', async () => {
    renderHook(() => useVistoriasByImovel(null, 'cli-1'), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockListByImovel).not.toHaveBeenCalled();
  });

  it('não executa quando clienteId é null', async () => {
    renderHook(() => useVistoriasByImovel('im-1', null), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockListByImovel).not.toHaveBeenCalled();
  });

  it('executa quando ambos presentes', async () => {
    mockListByImovel.mockResolvedValueOnce([{ id: 'v1' }]);
    const { result } = renderHook(() => useVistoriasByImovel('im-1', 'cli-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListByImovel).toHaveBeenCalledWith('im-1', 'cli-1');
    expect(result.current.data).toHaveLength(1);
  });
});

// ── useVistoriaResumo ─────────────────────────────────────────────────────────

describe('useVistoriaResumo', () => {
  beforeEach(() => { mockGetResumo.mockClear(); });

  it('não executa quando clienteId é null', async () => {
    renderHook(() => useVistoriaResumo(null, 'agente-1', 1), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetResumo).not.toHaveBeenCalled();
  });

  it('não executa quando agenteId é null', async () => {
    renderHook(() => useVistoriaResumo('cli-1', null, 1), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetResumo).not.toHaveBeenCalled();
  });

  it('executa com clienteId, agenteId e ciclo', async () => {
    const resumo = { total: 10, visitados: 7, pendentes: 3 };
    mockGetResumo.mockResolvedValueOnce(resumo);
    const { result } = renderHook(() => useVistoriaResumo('cli-1', 'agente-1', 2), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetResumo).toHaveBeenCalledWith('cli-1', 'agente-1', 2);
    expect(result.current.data).toEqual(resumo);
  });
});

// ── useCreateVistoriaMutation ─────────────────────────────────────────────────

describe('useCreateVistoriaMutation', () => {
  beforeEach(() => { mockCreate.mockClear(); });

  it('chama api.vistorias.create com o payload', async () => {
    const { result } = renderHook(() => useCreateVistoriaMutation(), { wrapper: makeWrapper() });
    const payload = {
      cliente_id: 'cli-1',
      imovel_id: 'im-1',
      agente_id: 'ag-1',
      ciclo: 1,
      tipo_atividade: 'tratamento' as const,
      data_visita: '2026-04-02',
      status: 'visitado' as const,
    };
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreate).toHaveBeenCalledWith(payload, expect.any(Object));
  });
});

// ── useUpdateVistoriaStatusMutation ──────────────────────────────────────────

describe('useUpdateVistoriaStatusMutation', () => {
  beforeEach(() => { mockUpdateStatus.mockClear(); });

  it('chama api.vistorias.updateStatus com id e status', async () => {
    const { result } = renderHook(() => useUpdateVistoriaStatusMutation(), { wrapper: makeWrapper() });
    result.current.mutate({ id: 'v1', status: 'revisita' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateStatus).toHaveBeenCalledWith('v1', 'revisita');
  });
});
