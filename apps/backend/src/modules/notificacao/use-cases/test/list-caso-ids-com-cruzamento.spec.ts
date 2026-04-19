import { ListCasoIdsComCruzamento } from '../list-caso-ids-com-cruzamento';

describe('ListCasoIdsComCruzamento', () => {
  let uc: ListCasoIdsComCruzamento;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new ListCasoIdsComCruzamento({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns empty array without DB call when casoIds is empty', async () => {
    const result = await uc.execute([], 'cliente-1');
    expect(result).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns list of caso_ids that have cruzamentos', async () => {
    queryRaw.mockResolvedValue([{ caso_id: 'caso-1' }, { caso_id: 'caso-2' }]);
    const result = await uc.execute(['caso-1', 'caso-2', 'caso-3'], 'cliente-1');
    expect(result).toEqual(['caso-1', 'caso-2']);
  });

  it('enforces tenant isolation via INNER JOIN', async () => {
    queryRaw.mockResolvedValue([]);
    await uc.execute(['caso-1'], 'cliente-1');
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('INNER JOIN casos_notificados');
  });
});
