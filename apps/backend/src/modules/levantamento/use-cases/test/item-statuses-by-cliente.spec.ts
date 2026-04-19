import { ItemStatusesByCliente } from '../item-statuses-by-cliente';

describe('ItemStatusesByCliente', () => {
  let uc: ItemStatusesByCliente;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    uc = new ItemStatusesByCliente({ client: { operacoes: { findMany } } } as never);
  });

  it('returns empty map when no operacoes', async () => {
    const result = await uc.execute('cli-1');
    expect(result).toEqual({});
  });

  it('builds status map with priority: concluido > em_andamento > others', async () => {
    findMany.mockResolvedValue([
      { item_levantamento_id: 'item-1', status: 'em_andamento' },
      { item_levantamento_id: 'item-1', status: 'concluido' },
      { item_levantamento_id: 'item-2', status: 'pendente' },
    ]);
    const result = await uc.execute('cli-1');
    expect(result['item-1']).toBe('concluido');
    expect(result['item-2']).toBe('pendente');
  });

  it('filters by clienteId and excludes null item_levantamento_id', async () => {
    await uc.execute('cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cliente_id: 'cli-1' }),
    }));
  });
});
