import { ListYoloClassConfig } from '../list-yolo-class-config';

describe('ListYoloClassConfig', () => {
  let uc: ListYoloClassConfig;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    uc = new ListYoloClassConfig({ client: { sentinela_yolo_class_config: { findMany } } } as never);
  });

  it('returns empty array when no config exists', async () => {
    const result = await uc.execute('cli-1');
    expect(result).toEqual([]);
  });

  it('filters by cliente_id and is_active=true', async () => {
    await uc.execute('cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cliente_id: 'cli-1', is_active: true },
    }));
  });

  it('orders by item_key', async () => {
    await uc.execute('cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { item_key: 'asc' },
    }));
  });
});
