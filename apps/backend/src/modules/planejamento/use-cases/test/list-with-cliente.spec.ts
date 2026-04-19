import { ListWithCliente } from '../list-with-cliente';

describe('ListWithCliente', () => {
  let uc: ListWithCliente;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([]);
    uc = new ListWithCliente({ client: { $queryRaw: queryRaw } } as never);
  });

  it('filters by clienteId when provided', async () => {
    await uc.execute('cli-1');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('cliente_id');
  });

  it('returns all planejamentos when clienteId is null (admin)', async () => {
    queryRaw.mockResolvedValue([{ id: 'p-1', cliente: { id: 'c-1' } }]);
    const result = await uc.execute(null);
    expect(result).toHaveLength(1);
  });

  it('uses INNER JOIN with clientes', async () => {
    await uc.execute('cli-1');
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('INNER JOIN clientes');
  });
});
