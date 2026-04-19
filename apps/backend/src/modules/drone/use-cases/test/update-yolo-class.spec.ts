import { UpdateYoloClass } from '../update-yolo-class';

describe('UpdateYoloClass', () => {
  let uc: UpdateYoloClass;
  let findFirst: jest.Mock;
  let update: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue({ id: 'cls-1', cliente_id: 'cli-1' });
    update    = jest.fn().mockResolvedValue({});
    uc = new UpdateYoloClass({ client: { sentinela_yolo_class_config: { findFirst, update } } } as never);
  });

  it('throws when class not found', async () => {
    findFirst.mockResolvedValue(null);
    await expect(uc.execute('cls-1', 'cli-1', {})).rejects.toThrow();
  });

  it('throws forbidden when class belongs to different tenant (IDOR)', async () => {
    findFirst.mockResolvedValue({ id: 'cls-1', cliente_id: 'other-tenant' });
    await expect(uc.execute('cls-1', 'cli-1', {})).rejects.toThrow();
  });

  it('updates is_active when provided', async () => {
    await uc.execute('cls-1', 'cli-1', { isActive: false });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ is_active: false }),
    }));
  });
});
