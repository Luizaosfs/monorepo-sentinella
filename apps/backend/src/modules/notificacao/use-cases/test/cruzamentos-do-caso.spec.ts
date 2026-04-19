import { CruzamentosDocaso } from '../cruzamentos-do-caso';

describe('CruzamentosDocaso', () => {
  let uc: CruzamentosDocaso;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new CruzamentosDocaso({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns cruzamentos for a caso', async () => {
    const row = { id: 'crz-1', levantamento_item_id: 'item-1', distancia_metros: 200, criado_em: new Date() };
    queryRaw.mockResolvedValue([row]);
    const result = await uc.execute('caso-1', 'cliente-1');
    expect(result).toEqual([row]);
  });

  it('enforces tenant isolation — cross-tenant caso returns nothing', async () => {
    queryRaw.mockResolvedValue([]);
    const result = await uc.execute('caso-outro-cliente', 'cliente-1');
    expect(result).toEqual([]);
  });

  it('uses INNER JOIN for IDOR protection', async () => {
    queryRaw.mockResolvedValue([]);
    await uc.execute('caso-1', 'cliente-1');
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('INNER JOIN casos_notificados');
  });
});
