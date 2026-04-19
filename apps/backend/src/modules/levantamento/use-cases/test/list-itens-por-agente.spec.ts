import { ListItensPorAgente } from '../list-itens-por-agente';

const mockQueryRaw = jest.fn();
const mockPrisma = { client: { $queryRaw: mockQueryRaw } };

describe('ListItensPorAgente', () => {
  let useCase: ListItensPorAgente;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListItensPorAgente(mockPrisma as any);
  });

  it('deve retornar lista de itens com operação do agente', async () => {
    const mockRows = [
      { id: 'item-1', item: 'PNEU', risco: 'alto', operacao_id: 'op-1', operacao_status: 'em_andamento' },
    ];
    mockQueryRaw.mockResolvedValue(mockRows);

    const result = await useCase.execute('usuario-1');

    expect(result).toEqual(mockRows);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('deve retornar lista vazia quando agente não tem itens', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('usuario-sem-itens');

    expect(result).toEqual([]);
  });
});
