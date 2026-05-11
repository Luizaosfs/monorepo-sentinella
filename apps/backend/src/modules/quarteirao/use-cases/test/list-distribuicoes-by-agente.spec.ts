import { ListDistribuicoesByAgente } from '../list-distribuicoes-by-agente';

describe('ListDistribuicoesByAgente', () => {
  let uc: ListDistribuicoesByAgente;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new ListDistribuicoesByAgente({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns distribuicao items for given agente and ciclo', async () => {
    queryRaw.mockResolvedValue([
      { quadra_id: 'qid-1', codigo: 'Q1', bairro_id: null },
      { quadra_id: 'qid-2', codigo: 'Q2', bairro_id: 'b-1' },
    ]);
    const result = await uc.execute('cli-1', 'ag-1', 'ciclo-uuid-3');
    expect(result).toEqual([
      { quadraId: 'qid-1', codigo: 'Q1', bairroId: null },
      { quadraId: 'qid-2', codigo: 'Q2', bairroId: 'b-1' },
    ]);
  });

  it('returns empty array when agente has no distribuicoes', async () => {
    queryRaw.mockResolvedValue([]);
    const result = await uc.execute('cli-1', 'ag-1', 'ciclo-uuid-3');
    expect(result).toEqual([]);
  });

  it('calls $queryRaw once per execute', async () => {
    queryRaw.mockResolvedValue([]);
    await uc.execute('cli-1', 'ag-1', 'ciclo-uuid-3');
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
