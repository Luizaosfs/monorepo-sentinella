import { ListDistribuicoesByAgente } from '../list-distribuicoes-by-agente';

describe('ListDistribuicoesByAgente', () => {
  let uc: ListDistribuicoesByAgente;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn();
    uc = new ListDistribuicoesByAgente({ client: { distribuicao_quarteirao: { findMany } } } as never);
  });

  it('returns quarteirao codes for given agente and ciclo', async () => {
    findMany.mockResolvedValue([{ quarteirao: 'Q1' }, { quarteirao: 'Q2' }]);
    const result = await uc.execute('cli-1', 'ag-1', 3);
    expect(result).toEqual(['Q1', 'Q2']);
  });

  it('returns empty array when agente has no distribuicoes', async () => {
    findMany.mockResolvedValue([]);
    const result = await uc.execute('cli-1', 'ag-1', 3);
    expect(result).toEqual([]);
  });

  it('filters by cliente_id for tenant isolation', async () => {
    findMany.mockResolvedValue([]);
    await uc.execute('cli-1', 'ag-1', 3);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cliente_id: 'cli-1', agente_id: 'ag-1', ciclo: 3 }),
    }));
  });
});
