import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const getCicloAtivo = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: 'ciclo-1',
    cliente_id: 'cli-1',
    ciclo_numero_efetivo: 3,
    status: 'ativo',
    data_inicio: '2026-01-01',
    data_fim_prevista: '2026-02-28',
    data_fechamento: null,
    meta_cobertura_pct: 80,
    snapshot_fechamento: null,
    observacao_abertura: null,
    observacao_fechamento: null,
    aberto_por: null,
    fechado_por: null,
    created_at: '',
    updated_at: '',
    numero: 3,
    ano: 2026,
    pct_tempo_decorrido: 0.5,
  }),
);

vi.mock('@/hooks/useClienteAtivo', () => ({
  useClienteAtivo: () => ({ clienteId: 'cli-uuid' }),
}));

vi.mock('@/services/api', () => ({
  api: {
    ciclos: {
      getCicloAtivo: getCicloAtivo,
    },
  },
}));

import { useCicloAtivo } from './useCicloAtivo';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCicloAtivo', () => {
  beforeEach(() => {
    getCicloAtivo.mockClear();
  });

  it('chama api.ciclos.getCicloAtivo com clienteId e expõe cicloNumero', async () => {
    const { result } = renderHook(() => useCicloAtivo(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getCicloAtivo).toHaveBeenCalledWith('cli-uuid');
    expect(result.current.cicloNumero).toBe(3);
    expect(result.current.data?.ciclo_numero_efetivo).toBe(3);
  });
});
