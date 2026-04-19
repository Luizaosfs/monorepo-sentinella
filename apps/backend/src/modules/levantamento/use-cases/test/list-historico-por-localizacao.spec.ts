import { ListHistoricoPorLocalizacao } from '../list-historico-por-localizacao';

const mockQueryRaw = jest.fn();
const mockPrisma = { client: { $queryRaw: mockQueryRaw } } as any;

describe('ListHistoricoPorLocalizacao', () => {
  let useCase: ListHistoricoPorLocalizacao;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListHistoricoPorLocalizacao(mockPrisma);
  });

  it('deve executar $queryRaw com clienteId e parâmetros de localização', async () => {
    const rows = [{ levantamento_item_id: 'item-1', latitude: -23.5505, longitude: -46.6333 }];
    mockQueryRaw.mockResolvedValue(rows);

    const result = await useCase.execute('cliente-1', -23.5505, -46.6333, 0.0001);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(rows);
  });

  it('deve retornar array vazio quando não há resultados', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-1', -23.5505, -46.6333, 0.0001);

    expect(result).toEqual([]);
  });
});
