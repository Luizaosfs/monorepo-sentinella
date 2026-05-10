import { DeletarDistribuicoes } from '../deletar-distribuicoes';

describe('DeletarDistribuicoes', () => {
  let uc: DeletarDistribuicoes;
  let deleteMany: jest.Mock;
  let findMany: jest.Mock;
  let executeRaw: jest.Mock;
  let ensureEditavel: jest.Mock;

  const makeUc = () =>
    new DeletarDistribuicoes(
      { client: { bairros_distribuicao: { findMany, deleteMany }, $executeRaw: executeRaw } } as never,
      { execute: ensureEditavel } as never,
      { user: { id: 'user-uuid-1' } } as never,
    );

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([
      { quadra_id: 'quadra-uuid-1', agente_id: 'agente-uuid-1' },
    ]);
    deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    executeRaw = jest.fn().mockResolvedValue(1);
    ensureEditavel = jest.fn().mockResolvedValue(undefined);
    uc = makeUc();
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

  it('blocks execution when ciclo is fechado', async () => {
    ensureEditavel.mockRejectedValueOnce(new Error('ciclo fechado'));
    await expect(
      uc.execute('cli-1', { cicloId: 'ciclo-uuid-1', quadraIds: ['quadra-uuid-1'] }),
    ).rejects.toThrow();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('filters by clienteId and ciclo_id for tenant isolation', async () => {
    await uc.execute('cli-1', { cicloId: 'ciclo-uuid-3', quadraIds: ['quadra-uuid-1'] });
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cliente_id: 'cli-1', ciclo_id: 'ciclo-uuid-3' }),
    }));
  });

  it('fetches existing rows before deleting for history', async () => {
    await uc.execute('cli-1', { cicloId: 'ciclo-uuid-1', quadraIds: ['quadra-uuid-1'] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ cliente_id: 'cli-1', ciclo_id: 'ciclo-uuid-1' }),
    }));
  });
});
