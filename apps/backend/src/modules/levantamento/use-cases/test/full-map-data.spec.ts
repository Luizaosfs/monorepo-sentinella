import { FullMapData } from '../full-map-data';

const emptyQueryRaw = jest.fn().mockResolvedValue([]);

describe('FullMapData', () => {
  let uc: FullMapData;
  let queryRaw: jest.Mock;
  let findFirst: jest.Mock;

  beforeEach(() => {
    queryRaw  = jest.fn().mockResolvedValue([]);
    findFirst = jest.fn().mockResolvedValue({ area: null });
    uc = new FullMapData({
      client: {
        $queryRaw:  queryRaw,
        clientes: { findFirst },
      },
    } as never);
  });

  it('returns correct shape with empty data', async () => {
    const result = await uc.execute('cli-1');
    expect(result).toHaveProperty('itens');
    expect(result).toHaveProperty('clienteArea');
    expect(result).toHaveProperty('planejamentos');
    expect(result).toHaveProperty('regioes');
    expect(result).toHaveProperty('pluvioRiscoMap');
  });

  it('builds pluvioRiscoMap indexed by regiao_id', async () => {
    const regiao = { id: 'reg-1', regiao: 'Norte', area: null };
    const pluvio = { regiao_id: 'reg-1', nivel_risco: 'alto' };
    queryRaw
      .mockResolvedValueOnce([])         // itens
      .mockResolvedValueOnce([])         // planejamentos
      .mockResolvedValueOnce([regiao])   // regioes
      .mockResolvedValueOnce([pluvio]);  // pluvio_risco
    const result = await uc.execute('cli-1');
    expect(result.pluvioRiscoMap['reg-1']).toEqual(pluvio);
  });

  it('skips pluvio query when no regioes with area', async () => {
    queryRaw.mockResolvedValue([]);
    await uc.execute('cli-1');
    // $queryRaw called 3 times: itens + planejamentos + regioes (no 4th for pluvio)
    expect(queryRaw.mock.calls.length).toBe(3);
  });
});
