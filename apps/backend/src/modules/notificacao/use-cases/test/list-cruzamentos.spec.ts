import { ListCruzamentos } from '../list-cruzamentos';

describe('ListCruzamentos', () => {
  let uc: ListCruzamentos;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new ListCruzamentos({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns list of cruzamentos with item, distance, date', async () => {
    const row = { levantamento_item_id: 'item-1', distancia_metros: 80, criado_em: new Date() };
    queryRaw.mockResolvedValue([row]);
    const result = await uc.execute('cliente-1');
    expect(result).toEqual([row]);
  });

  it('enforces tenant isolation via INNER JOIN', async () => {
    queryRaw.mockResolvedValue([]);
    await uc.execute('cliente-1');
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('INNER JOIN casos_notificados');
  });
});
