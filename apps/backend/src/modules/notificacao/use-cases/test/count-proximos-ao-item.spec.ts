import { CountProximosAoItem } from '../count-proximos-ao-item';

describe('CountProximosAoItem', () => {
  let uc: CountProximosAoItem;
  let findFirst: jest.Mock;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn();
    queryRaw = jest.fn();
    uc = new CountProximosAoItem({
      client: {
        levantamento_itens: { findFirst },
        $queryRaw: queryRaw,
      },
    } as never);
  });

  it('returns 0 when item not found', async () => {
    findFirst.mockResolvedValue(null);
    const result = await uc.execute('item-1', 'cliente-1');
    expect(result).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns 0 when item has no coordinates', async () => {
    findFirst.mockResolvedValue({ latitude: null, longitude: null });
    const result = await uc.execute('item-1', 'cliente-1');
    expect(result).toBe(0);
  });

  it('returns count from PostGIS query', async () => {
    findFirst.mockResolvedValue({ latitude: -23.5, longitude: -46.6 });
    queryRaw.mockResolvedValue([{ total: 5 }]);
    const result = await uc.execute('item-1', 'cliente-1');
    expect(result).toBe(5);
  });
});
