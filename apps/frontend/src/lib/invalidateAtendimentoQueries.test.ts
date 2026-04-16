import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateAtendimentoItemCaches } from './invalidateAtendimentoQueries';

describe('invalidateAtendimentoItemCaches', () => {
  it('invalida todas as query keys base sem levantamentoId', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateAtendimentoItemCaches(queryClient, { clienteId: 'cli-1' });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['itens_cliente', 'cli-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['itens_operador', 'cli-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['map_items', 'cli-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['map_full_data', 'cli-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['item_statuses', 'cli-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['atendimento_counts', 'cli-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['itens_resolvidos_recentes', 'cli-1'] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['levantamento_itens', expect.anything()] });
  });

  it('invalida levantamento_itens quando levantamentoId está definido', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateAtendimentoItemCaches(queryClient, {
      clienteId: 'cli-1',
      levantamentoId: 'lev-99',
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['levantamento_itens', 'lev-99'] });
  });
});
