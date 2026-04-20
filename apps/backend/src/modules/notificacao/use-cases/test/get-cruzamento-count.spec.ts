import { GetCruzamentoCount } from '../get-cruzamento-count';

describe('GetCruzamentoCount', () => {
  let uc: GetCruzamentoCount;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new GetCruzamentoCount({ client: { $queryRaw: queryRaw } } as never);
  });

  it('retorna count de levantamento_item_ids distintos com cruzamento', async () => {
    queryRaw.mockResolvedValue([{ count: 7 }]);
    const result = await uc.execute('cliente-uuid-aaa');
    expect(result).toBe(7);
  });

  it('retorna 0 quando não há cruzamentos com levantamento_item', async () => {
    queryRaw.mockResolvedValue([{ count: 0 }]);
    const result = await uc.execute('cliente-uuid-aaa');
    expect(result).toBe(0);
  });

  it('filtra por clienteId — prova isolamento com 2 clientes distintos', async () => {
    queryRaw
      .mockResolvedValueOnce([{ count: 5 }])
      .mockResolvedValueOnce([{ count: 2 }]);

    const r1 = await uc.execute('cliente-uuid-aaa');
    const r2 = await uc.execute('cliente-uuid-bbb');

    expect(r1).toBe(5);
    expect(r2).toBe(2);

    expect(queryRaw.mock.calls[0][0].values).toContain('cliente-uuid-aaa');
    expect(queryRaw.mock.calls[1][0].values).toContain('cliente-uuid-bbb');
  });

  it('usa INNER JOIN em casos_notificados para garantir filtro por cliente', async () => {
    queryRaw.mockResolvedValue([{ count: 0 }]);
    await uc.execute('cliente-uuid-aaa');
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('INNER JOIN casos_notificados');
  });
});
