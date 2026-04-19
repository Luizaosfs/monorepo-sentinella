import { CountCruzadosHoje } from '../count-cruzados-hoje';

describe('CountCruzadosHoje', () => {
  let uc: CountCruzadosHoje;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new CountCruzadosHoje({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns count of distinct casos cruzados today', async () => {
    queryRaw.mockResolvedValue([{ total: 3 }]);
    const result = await uc.execute('cliente-1');
    expect(result).toBe(3);
  });

  it('returns 0 when no cruzamentos today', async () => {
    queryRaw.mockResolvedValue([{ total: 0 }]);
    const result = await uc.execute('cliente-1');
    expect(result).toBe(0);
  });

  it('enforces tenant isolation via INNER JOIN', async () => {
    queryRaw.mockResolvedValue([{ total: 0 }]);
    await uc.execute('cliente-1');
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('INNER JOIN casos_notificados');
  });
});
