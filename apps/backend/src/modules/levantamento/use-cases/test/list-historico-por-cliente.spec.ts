import { ListHistoricoPorCliente } from '../list-historico-por-cliente';

const mockQueryRaw = jest.fn();
const mockPrisma = { client: { $queryRaw: mockQueryRaw } } as any;

describe('ListHistoricoPorCliente', () => {
  let useCase: ListHistoricoPorCliente;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListHistoricoPorCliente(mockPrisma);
  });

  it('deve executar $queryRaw com clienteId', async () => {
    const rows = [
      { levantamento_item_id: 'item-1', cliente_id: 'cliente-1' },
      { levantamento_item_id: 'item-2', cliente_id: 'cliente-1' },
    ];
    mockQueryRaw.mockResolvedValue(rows);

    const result = await useCase.execute('cliente-1');

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(rows);
  });

  it('deve retornar array vazio quando não há resultados', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-1');

    expect(result).toEqual([]);
  });
});
