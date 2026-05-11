import { BulkInsertRegioes } from '../bulk-insert-regioes';

describe('BulkInsertRegioes', () => {
  let uc: BulkInsertRegioes;
  let findMany: jest.Mock;
  let createMany: jest.Mock;
  let bairrosUpdate: jest.Mock;
  let executeRaw: jest.Mock;

  beforeEach(() => {
    findMany     = jest.fn().mockResolvedValue([]);
    createMany   = jest.fn().mockResolvedValue({ count: 0 });
    bairrosUpdate = jest.fn().mockResolvedValue({});
    executeRaw   = jest.fn().mockResolvedValue(1);
    uc = new BulkInsertRegioes({
      client: {
        bairros: { findMany, createMany, update: bairrosUpdate },
        $executeRaw: executeRaw,
      },
    } as never);
  });

  it('returns { inserted: 0, updated: 0 } for empty rows without touching the db', async () => {
    const result = await uc.execute('cli-1', { rows: [] });
    expect(result).toEqual({ inserted: 0, updated: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('calls createMany for rows without geojson and returns inserted count', async () => {
    createMany.mockResolvedValue({ count: 2 });
    const result = await uc.execute('cli-1', {
      rows: [{ nome: 'Bairro A' }, { nome: 'Bairro B' }],
    });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ inserted: 2, updated: 0 });
  });

  it('SQL references ST_GeomFromGeoJSON when geojson is present', async () => {
    await uc.execute('cli-1', {
      rows: [{ nome: 'Norte', geojson: { type: 'Polygon', coordinates: [] } }],
    });
    const sqlObj = executeRaw.mock.calls[0][0] as { strings: string[] };
    const sqlText = sqlObj.strings.join('');
    expect(sqlText).toContain('ST_GeomFromGeoJSON');
  });
});
