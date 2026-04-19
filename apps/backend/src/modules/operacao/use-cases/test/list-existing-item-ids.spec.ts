import { ListExistingItemIds } from '../list-existing-item-ids';

const mockFindMany = jest.fn();
const mockPrisma = {
  client: {
    operacoes: { findMany: mockFindMany },
  },
} as any;

describe('ListExistingItemIds', () => {
  let useCase: ListExistingItemIds;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListExistingItemIds(mockPrisma);
  });

  it('deve retornar ids de itens com operação pendente/em_andamento do tenant', async () => {
    mockFindMany.mockResolvedValue([
      { item_operacional_id: 'item-1' },
      { item_operacional_id: 'item-3' },
    ]);

    const result = await useCase.execute('cliente-1', ['item-1', 'item-2', 'item-3']);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        cliente_id:          'cliente-1',
        status:              { in: ['pendente', 'em_andamento'] },
        item_operacional_id: { in: ['item-1', 'item-2', 'item-3'] },
        deleted_at:          null,
      },
      select: { item_operacional_id: true },
    });
    expect(result).toEqual(['item-1', 'item-3']);
  });

  it('deve retornar [] sem query quando itemIds está vazio', async () => {
    const result = await useCase.execute('cliente-1', []);

    expect(mockFindMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('deve filtrar nulls do resultado', async () => {
    mockFindMany.mockResolvedValue([
      { item_operacional_id: 'item-1' },
      { item_operacional_id: null },
    ]);

    const result = await useCase.execute('cliente-1', ['item-1', 'item-2']);

    expect(result).toEqual(['item-1']);
  });
});
