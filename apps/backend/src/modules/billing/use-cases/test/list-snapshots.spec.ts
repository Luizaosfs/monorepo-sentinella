import { ListSnapshots } from '../list-snapshots';

describe('ListSnapshots', () => {
  it('retorna até 12 snapshots do cliente ordenados por periodo_inicio desc', async () => {
    const snapshots = [{ id: 's1', cliente_id: 'c1' }];
    const findMany = jest.fn().mockResolvedValue(snapshots);
    const uc = new ListSnapshots({ client: { billing_usage_snapshot: { findMany } } } as never);

    const result = await uc.execute('c1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cliente_id: 'c1' },
        orderBy: [{ periodo_inicio: 'desc' }],
        take: 12,
      }),
    );
    expect(result).toEqual(snapshots);
  });
});
