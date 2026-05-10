import { ListDistribuicoesByAgente } from '../list-distribuicoes-by-agente';

describe('ListDistribuicoesByAgente', () => {
  let uc: ListDistribuicoesByAgente;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new ListDistribuicoesByAgente({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns quarteirao codes for given agente and ciclo', async () => {
    queryRaw.mockResolvedValue([{ codigo: 'Q1' }, { codigo: 'Q2' }]);
    const result = await uc.execute('cli-1', 'ag-1', 'ciclo-uuid-3');
    expect(result).toEqual(['Q1', 'Q2']);
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
