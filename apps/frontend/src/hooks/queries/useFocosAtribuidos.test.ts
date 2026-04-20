import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { FocoRiscoAtivo } from '@/types/database';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockList = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [], count: 0 }),
);

vi.mock('@/services/api', () => ({
  api: {
    focosRisco: { list: mockList },
  },
}));

import { useFocosAtribuidos } from './useFocosAtribuidos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return QueryClientProvider({ client: qc, children });
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useFocosAtribuidos', () => {
  beforeEach(() => {
    mockList.mockClear();
    mockList.mockResolvedValue({ data: [], count: 0 });
  });

  it('não chama a API quando clienteId é null', async () => {
    renderHook(() => useFocosAtribuidos(null, 'resp-1'), {
      wrapper: makeWrapper(),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockList).not.toHaveBeenCalled();
  });

  it('não chama a API quando responsavelId é null', async () => {
    renderHook(() => useFocosAtribuidos('cli-1', null), {
      wrapper: makeWrapper(),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockList).not.toHaveBeenCalled();
  });

  it('não chama a API quando ambos são null', async () => {
    renderHook(() => useFocosAtribuidos(null, null), {
      wrapper: makeWrapper(),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockList).not.toHaveBeenCalled();
  });

  it('chama api.focosRisco.list com status corretos e responsavel_id quando ambos estão presentes', async () => {
    renderHook(() => useFocosAtribuidos('cli-1', 'resp-1'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(mockList).toHaveBeenCalledWith('cli-1', {
      status: ['aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'],
      responsavel_id: 'resp-1',
      pageSize: 50,
    });
  });

  it('retorna isLoading=true e data=[] enquanto a query ainda não resolveu', () => {
    // Nunca resolve — simula loading infinito
    mockList.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFocosAtribuidos('cli-1', 'resp-1'), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('retorna os dados após resolução da query', async () => {
    const focos: Partial<FocoRiscoAtivo>[] = [
      { id: 'f1', status: 'aguarda_inspecao' },
      { id: 'f2', status: 'em_inspecao' },
    ];
    mockList.mockResolvedValueOnce({ data: focos, count: 2 });
    const { result } = renderHook(() => useFocosAtribuidos('cli-1', 'resp-1'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0].id).toBe('f1');
    expect(result.current.data[1].id).toBe('f2');
  });

  it('retorna [] (não undefined) quando a query retorna data vazio', async () => {
    mockList.mockResolvedValueOnce({ data: [], count: 0 });
    const { result } = renderHook(() => useFocosAtribuidos('cli-1', 'resp-1'), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(result.current.data).not.toBeUndefined();
  });
});
