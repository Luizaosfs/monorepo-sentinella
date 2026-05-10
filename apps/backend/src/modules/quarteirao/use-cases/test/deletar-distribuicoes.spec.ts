import { DeletarDistribuicoes } from '../deletar-distribuicoes';

describe('DeletarDistribuicoes', () => {
  let uc: DeletarDistribuicoes;
  let deleteMany: jest.Mock;

  beforeEach(() => {
    deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    uc = new DeletarDistribuicoes({ client: { bairros_distribuicao: { deleteMany } } } as never);
  });

  it('returns deleted count', async () => {
    const result = await uc.execute('cli-1', { cicloId: 'ciclo-uuid-1', quadraIds: ['quadra-uuid-1', 'quadra-uuid-2'] });
    expect(result).toEqual({ deleted: 2 });
  });

  it('returns 0 and skips DB when quadraIds is empty', async () => {
    const result = await uc.execute('cli-1', { cicloId: 'ciclo-uuid-1', quadraIds: [] });
    expect(result).toEqual({ deleted: 0 });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('filters by clienteId and ciclo_id for tenant isolation', async () => {
    await uc.execute('cli-1', { cicloId: 'ciclo-uuid-3', quadraIds: ['quadra-uuid-1'] });
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cliente_id: 'cli-1', ciclo_id: 'ciclo-uuid-3' }),
    }));
  });
});
