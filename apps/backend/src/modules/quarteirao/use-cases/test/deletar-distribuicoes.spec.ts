import { DeletarDistribuicoes } from '../deletar-distribuicoes';

describe('DeletarDistribuicoes', () => {
  let uc: DeletarDistribuicoes;
  let deleteMany: jest.Mock;

  beforeEach(() => {
    deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    uc = new DeletarDistribuicoes({ client: { distribuicao_quarteirao: { deleteMany } } } as never);
  });

  it('returns deleted count', async () => {
    const result = await uc.execute('cli-1', { ciclo: 1, quarteiroes: ['Q1', 'Q2'] });
    expect(result).toEqual({ deleted: 2 });
  });

  it('returns 0 and skips DB when quarteiroes is empty', async () => {
    const result = await uc.execute('cli-1', { ciclo: 1, quarteiroes: [] });
    expect(result).toEqual({ deleted: 0 });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('filters by clienteId and ciclo for tenant isolation', async () => {
    await uc.execute('cli-1', { ciclo: 3, quarteiroes: ['Q1'] });
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cliente_id: 'cli-1', ciclo: 3 }),
    }));
  });
});
