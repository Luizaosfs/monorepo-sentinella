import { ListItensMapa } from '../list-itens-mapa';

const mockQueryRaw = jest.fn();
const mockPrisma = { client: { $queryRaw: mockQueryRaw } };

describe('ListItensMapa', () => {
  let useCase: ListItensMapa;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListItensMapa(mockPrisma as any);
  });

  it('deve retornar itens com coordenadas para o cliente', async () => {
    const mockPoints = [
      { id: 'item-1', latitude: -23.5, longitude: -46.6, item: 'PNEU', risco: 'alto', prioridade: 'P2' },
    ];
    mockQueryRaw.mockResolvedValue(mockPoints);

    const result = await useCase.execute('cliente-1');

    expect(result).toEqual(mockPoints);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('deve retornar lista vazia quando não há itens com localização', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-sem-itens');

    expect(result).toEqual([]);
  });
});
