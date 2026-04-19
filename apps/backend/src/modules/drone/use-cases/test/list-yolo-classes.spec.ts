import { ListYoloClasses } from '../list-yolo-classes';

describe('ListYoloClasses', () => {
  let uc: ListYoloClasses;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    uc = new ListYoloClasses({ client: { sentinela_yolo_class_config: { findMany } } } as never);
  });

  it('returns empty array when no classes exist', async () => {
    expect(await uc.execute('cli-1')).toEqual([]);
  });

  it('filters by cliente_id only (no is_active filter — returns all)', async () => {
    await uc.execute('cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cliente_id: 'cli-1' },
    }));
  });

  it('orders by item_key asc', async () => {
    await uc.execute('cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { item_key: 'asc' },
    }));
  });
});
