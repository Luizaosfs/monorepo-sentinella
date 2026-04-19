import { ListSynonyms } from '../list-synonyms';

describe('ListSynonyms', () => {
  let uc: ListSynonyms;
  let findMany: jest.Mock;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    uc = new ListSynonyms({ client: { sentinela_yolo_synonym: { findMany } } } as never);
  });

  it('returns empty array when no synonyms', async () => {
    expect(await uc.execute('cli-1')).toEqual([]);
  });

  it('filters by cliente_id', async () => {
    await uc.execute('cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cliente_id: 'cli-1' },
    }));
  });

  it('orders by synonym asc', async () => {
    await uc.execute('cli-1');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { synonym: 'asc' },
    }));
  });
});
