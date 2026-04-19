import { VoosByPlanejamento } from '../voos-by-planejamento';

describe('VoosByPlanejamento', () => {
  let uc: VoosByPlanejamento;
  let findFirst: jest.Mock;
  let findMany: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue({ id: 'p-1' });
    findMany  = jest.fn().mockResolvedValue([]);
    uc = new VoosByPlanejamento({
      client: {
        planejamento: { findFirst },
        voos: { findMany },
      },
    } as never);
  });

  it('returns voos for a planejamento', async () => {
    const voo = { id: 'v-1', inicio: new Date() };
    findMany.mockResolvedValue([voo]);
    const result = await uc.execute('p-1', 'cli-1');
    expect(result).toEqual([voo]);
  });

  it('throws when planejamento not found for tenant', async () => {
    findFirst.mockResolvedValue(null);
    await expect(uc.execute('p-other', 'cli-1')).rejects.toThrow();
  });

  it('skips IDOR check for admin (clienteId null)', async () => {
    findMany.mockResolvedValue([{ id: 'v-2' }]);
    const result = await uc.execute('p-1', null);
    expect(findFirst).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
