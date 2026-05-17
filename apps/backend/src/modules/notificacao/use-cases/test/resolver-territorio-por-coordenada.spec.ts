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
      quadraAproximada: false,
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
      quadraAproximada: false,
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('snap escalonado — ST_Contains vazio, acha no 2º raio (15m) e marca aproximada', async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: 'bairro-1', nome: 'Santa Luzia' }]) // bairro estrito
      .mockResolvedValueOnce([])                                        // quadra ST_Contains
      .mockResolvedValueOnce([])                                        // snap 5m: nada
      .mockResolvedValueOnce([{ id: 'q-056', codigo: 'Q056' }]);        // snap 15m: acha

    const r = await uc.execute({
      clienteId: 'cli1',
      latitude: -20.7808,
      longitude: -51.7237,
      quadraSnapMetros: [5, 15],
    });

    expect(r.bairroId).toBe('bairro-1');
    expect(r.quadraId).toBe('q-056');
    expect(r.quadraCodigo).toBe('Q056');
    expect(r.quadraAproximada).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(4); // bairro + contains + 5m + 15m
  });

  it('sem quadraSnapMetros não dispara snap (estrito) e quadraAproximada=false', async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: 'bairro-1', nome: 'Centro' }])
      .mockResolvedValueOnce([]); // quadra ST_Contains: nada

    const r = await uc.execute({ clienteId: 'cli1', latitude: -20.79, longitude: -51.7 });

    expect(r.quadraId).toBeNull();
    expect(r.quadraAproximada).toBe(false);
    expect(queryRaw).toHaveBeenCalledTimes(2); // sem snap
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
