import { GetUltimoSnapshot } from '../get-ultimo-snapshot';

describe('GetUltimoSnapshot', () => {
  it('retorna o snapshot mais recente do cliente', async () => {
    const snapshot = { id: 's1', cliente_id: 'c1', periodo_inicio: new Date() };
    const findFirst = jest.fn().mockResolvedValue(snapshot);
    const uc = new GetUltimoSnapshot({ client: { billing_usage_snapshot: { findFirst } } } as never);

    const result = await uc.execute('c1');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cliente_id: 'c1' },
        orderBy: [{ periodo_inicio: 'desc' }],
      }),
    );
    expect(result).toEqual(snapshot);
  });

  it('retorna null quando não há snapshots', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const uc = new GetUltimoSnapshot({ client: { billing_usage_snapshot: { findFirst } } } as never);

    const result = await uc.execute('c1');
    expect(result).toBeNull();
  });
});
