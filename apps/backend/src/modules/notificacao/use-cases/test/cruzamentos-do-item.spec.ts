import { CruzamentosDoItem } from '../cruzamentos-do-item';

describe('CruzamentosDoItem', () => {
  let uc: CruzamentosDoItem;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new CruzamentosDoItem({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns cruzamentos with nested caso object', async () => {
    const row = { id: 'crz-1', distancia_metros: 150, caso: { id: 'caso-1', doenca: 'dengue' } };
    queryRaw.mockResolvedValue([row]);
    const result = await uc.execute('item-1', 'cliente-1');
    expect(result).toEqual([row]);
  });

  it('returns empty array when no cruzamentos exist', async () => {
    queryRaw.mockResolvedValue([]);
    const result = await uc.execute('item-1', 'cliente-1');
    expect(result).toEqual([]);
  });

  it('enforces tenant isolation via INNER JOIN on casos_notificados', async () => {
    queryRaw.mockResolvedValue([]);
    await uc.execute('item-1', 'cliente-1');
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('INNER JOIN casos_notificados');
  });
});
