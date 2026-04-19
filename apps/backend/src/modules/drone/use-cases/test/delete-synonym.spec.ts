import { DeleteSynonym } from '../delete-synonym';

describe('DeleteSynonym', () => {
  let uc: DeleteSynonym;
  let findFirst: jest.Mock;
  let del: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue({ id: 'syn-1', cliente_id: 'cli-1' });
    del       = jest.fn().mockResolvedValue({});
    uc = new DeleteSynonym({
      client: { sentinela_yolo_synonym: { findFirst, delete: del } },
    } as never);
  });

  it('throws when synonym not found', async () => {
    findFirst.mockResolvedValue(null);
    await expect(uc.execute('syn-1', 'cli-1')).rejects.toThrow();
  });

  it('throws forbidden when synonym belongs to different tenant (IDOR)', async () => {
    findFirst.mockResolvedValue({ id: 'syn-1', cliente_id: 'other' });
    await expect(uc.execute('syn-1', 'cli-1')).rejects.toThrow();
  });

  it('deletes by id when ownership verified', async () => {
    await uc.execute('syn-1', 'cli-1');
    expect(del).toHaveBeenCalledWith({ where: { id: 'syn-1' } });
  });
});
