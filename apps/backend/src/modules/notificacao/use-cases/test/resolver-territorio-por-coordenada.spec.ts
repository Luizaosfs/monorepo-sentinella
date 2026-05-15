import { ResolverTerritorioPorCoordenada } from '../resolver-territorio-por-coordenada';

describe('ResolverTerritorioPorCoordenada', () => {
  let uc: ResolverTerritorioPorCoordenada;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new ResolverTerritorioPorCoordenada({
      client: { $queryRaw: queryRaw },
    } as never);
  });

  it('retorna null sem consultar DB quando lat/lng são nulos', async () => {
    const r = await uc.execute({
      clienteId: 'cli1',
      latitude: null,
      longitude: null,
    });
    expect(r).toEqual({
      bairroId: null,
      bairroNome: null,
      quadraId: null,
      quadraCodigo: null,
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('resolve bairro e quadra via ST_Contains', async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: 'bairro-1', nome: 'Centro' }])
      .mockResolvedValueOnce([{ id: 'quadra-1', codigo: 'Q-007' }]);

    const r = await uc.execute({
      clienteId: 'cli1',
      latitude: -20.79,
      longitude: -51.7,
    });

    expect(r).toEqual({
      bairroId: 'bairro-1',
      bairroNome: 'Centro',
      quadraId: 'quadra-1',
      quadraCodigo: 'Q-007',
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('retorna quadra null quando ponto não cai em nenhuma quadra', async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: 'bairro-1', nome: 'Centro' }])
      .mockResolvedValueOnce([]);

    const r = await uc.execute({
      clienteId: 'cli1',
      latitude: -20.79,
      longitude: -51.7,
    });

    expect(r.bairroId).toBe('bairro-1');
    expect(r.quadraId).toBeNull();
    expect(r.quadraCodigo).toBeNull();
  });
});
