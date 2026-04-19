import { BulkInsertRegioes } from '../bulk-insert-regioes';

describe('BulkInsertRegioes', () => {
  let uc: BulkInsertRegioes;
  let executeRaw: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    executeRaw = jest.fn().mockReturnValue(Promise.resolve(1));
    transaction = jest.fn().mockImplementation((ops: Promise<number>[]) => Promise.all(ops));
    uc = new BulkInsertRegioes({
      client: { $executeRaw: executeRaw, $transaction: transaction },
    } as never);
  });

  it('returns { count: 0 } for empty rows without touching the db', async () => {
    const result = await uc.execute('cli-1', { rows: [] });
    expect(result).toEqual({ count: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('calls $executeRaw once per row and returns total count', async () => {
    const result = await uc.execute('cli-1', {
      rows: [{ nome: 'Bairro A' }, { nome: 'Bairro B' }],
    });
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ count: 2 });
  });

  it('SQL references ST_GeomFromGeoJSON when geojson is present', async () => {
    await uc.execute('cli-1', {
      rows: [{ nome: 'Norte', geojson: { type: 'Polygon', coordinates: [] } }],
    });
    // Prisma.sql returns a Sql object; the literal template parts are in .strings
    const sqlObj = executeRaw.mock.calls[0][0] as { strings: string[] };
    const sqlText = sqlObj.strings.join('');
    expect(sqlText).toContain('ST_GeomFromGeoJSON');
  });
});
