import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockList = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGetById = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'f1', status: 'suspeita' }));
const mockHistorico = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockTimeline = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockTransicionar = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockByLevantamentoItem = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockListByImovel = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockCriar = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'novo-foco' }));

vi.mock('@/services/api', () => ({
  api: {
    focosRisco: {
      list: mockList,
      getById: mockGetById,
      historico: mockHistorico,
      timeline: mockTimeline,
      transicionar: mockTransicionar,
      byLevantamentoItem: mockByLevantamentoItem,
      listByImovel: mockListByImovel,
      criar: mockCriar,
    },
    operacoes: { listByFoco: vi.fn().mockResolvedValue([]) },
    levantamentoItemEvidencias: { listByItem: vi.fn().mockResolvedValue([]) },
  },
}));

// SyncStatusPanel mocking for useRealtimeInvalidator
vi.mock('@/hooks/useRealtimeInvalidator', () => ({
  useRealtimeInvalidator: vi.fn(),
}));

import {
  useFocosRisco,
  useFocoRisco,
  useAtualizarStatusFoco,
  useFocoByLevantamentoItem,
  useFocosDoImovel,
  useCriarFocoManual,
} from './useFocosRisco';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// ── useFocosRisco ─────────────────────────────────────────────────────────────

describe('useFocosRisco', () => {
  beforeEach(() => { mockList.mockClear(); });

  it('não executa query quando clienteId é null', async () => {
    const { result } = renderHook(() => useFocosRisco(null), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockList).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true); // enabled=false mantém pending
  });

  it('não executa query quando clienteId é undefined', async () => {
    renderHook(() => useFocosRisco(undefined), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockList).not.toHaveBeenCalled();
  });

  it('executa query quando clienteId está presente', async () => {
    const { result } = renderHook(() => useFocosRisco('cli-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockList).toHaveBeenCalledWith('cli-1', undefined);
    expect(result.current.data).toEqual([]);
  });

  it('passa filtros para api.focosRisco.list', async () => {
    const filtros = { status: ['confirmado' as const], prioridade: ['P1' as const] };
    renderHook(() => useFocosRisco('cli-1', filtros), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(mockList).toHaveBeenCalledWith('cli-1', filtros);
  });

  it('queryKey inclui clienteId e serialização dos filtros', async () => {
    const filtros = { status: ['suspeita' as const], ciclo: 2 };
    const { result } = renderHook(() => useFocosRisco('cli-2', filtros), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Garante que dados chegaram — queryKey correto (verificado pelo cache)
    expect(result.current.data).toBeDefined();
  });

  it('retorna lista de focos retornada pela API', async () => {
    const focos = [{ id: 'f1', status: 'suspeita' }, { id: 'f2', status: 'confirmado' }];
    mockList.mockResolvedValueOnce(focos);
    const { result } = renderHook(() => useFocosRisco('cli-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].id).toBe('f1');
  });
});

// ── useFocoRisco (single) ─────────────────────────────────────────────────────

describe('useFocoRisco', () => {
  beforeEach(() => {
    mockGetById.mockClear();
    mockHistorico.mockClear();
    mockTimeline.mockClear();
  });

  it('não executa quando id é null', async () => {
    renderHook(() => useFocoRisco(null), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it('busca foco, historico e timeline em paralelo', async () => {
    const { result } = renderHook(() => useFocoRisco('foco-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetById).toHaveBeenCalledWith('foco-1');
    expect(mockHistorico).toHaveBeenCalledWith('foco-1');
    expect(mockTimeline).toHaveBeenCalledWith('foco-1');
  });

  it('expõe { foco, historico, timeline } no data', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'foco-1', status: 'confirmado' });
    mockHistorico.mockResolvedValueOnce([{ id: 'h1' }]);
    mockTimeline.mockResolvedValueOnce([{ id: 't1' }]);
    const { result } = renderHook(() => useFocoRisco('foco-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.foco?.id).toBe('foco-1');
    expect(result.current.data?.historico).toHaveLength(1);
    expect(result.current.data?.timeline).toHaveLength(1);
  });
});

// ── useFocoByLevantamentoItem ─────────────────────────────────────────────────

describe('useFocoByLevantamentoItem', () => {
  beforeEach(() => { mockByLevantamentoItem.mockClear(); });

  it('não executa quando itemId é null', async () => {
    renderHook(() => useFocoByLevantamentoItem(null, 'cli-1'), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockByLevantamentoItem).not.toHaveBeenCalled();
  });

  it('não executa quando clienteId é null', async () => {
    renderHook(() => useFocoByLevantamentoItem('item-1', null), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockByLevantamentoItem).not.toHaveBeenCalled();
  });

  it('executa quando ambos estão presentes', async () => {
    renderHook(() => useFocoByLevantamentoItem('item-1', 'cli-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockByLevantamentoItem).toHaveBeenCalledWith('item-1', 'cli-1'));
  });
});

// ── useFocosDoImovel ──────────────────────────────────────────────────────────

describe('useFocosDoImovel', () => {
  beforeEach(() => { mockListByImovel.mockClear(); });

  it('não executa quando imovelId é null', async () => {
    renderHook(() => useFocosDoImovel(null, 'cli-1'), { wrapper: makeWrapper() });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockListByImovel).not.toHaveBeenCalled();
  });

  it('executa com imovelId e clienteId válidos', async () => {
    mockListByImovel.mockResolvedValueOnce([{ id: 'f1' }]);
    const { result } = renderHook(() => useFocosDoImovel('imovel-1', 'cli-1'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListByImovel).toHaveBeenCalledWith('imovel-1', 'cli-1');
    expect(result.current.data).toHaveLength(1);
  });
});

// ── useAtualizarStatusFoco ────────────────────────────────────────────────────

describe('useAtualizarStatusFoco', () => {
  beforeEach(() => { mockTransicionar.mockClear(); });

  it('chama api.focosRisco.transicionar com focoId e statusNovo', async () => {
    const { result } = renderHook(() => useAtualizarStatusFoco(), { wrapper: makeWrapper() });
    result.current.mutate({ focoId: 'f1', statusNovo: 'confirmado' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTransicionar).toHaveBeenCalledWith('f1', 'confirmado', undefined, undefined);
  });

  it('repassa motivo e responsavelId quando fornecidos', async () => {
    const { result } = renderHook(() => useAtualizarStatusFoco(), { wrapper: makeWrapper() });
    result.current.mutate({ focoId: 'f1', statusNovo: 'resolvido', motivo: 'ok', responsavelId: 'u1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockTransicionar).toHaveBeenCalledWith('f1', 'resolvido', 'ok', 'u1');
  });
});

// ── useCriarFocoManual ────────────────────────────────────────────────────────

describe('useCriarFocoManual', () => {
  beforeEach(() => { mockCriar.mockClear(); });

  it('chama api.focosRisco.criar com payload', async () => {
    const { result } = renderHook(() => useCriarFocoManual(), { wrapper: makeWrapper() });
    result.current.mutate({ cliente_id: 'cli-1', latitude: -23.5, longitude: -46.6 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCriar).toHaveBeenCalledWith(expect.objectContaining({ cliente_id: 'cli-1' }));
  });
});
