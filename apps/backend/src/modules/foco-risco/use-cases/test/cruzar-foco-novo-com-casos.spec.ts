import { CruzarFocoNovoComCasos } from '../cruzar-foco-novo-com-casos';

describe('CruzarFocoNovoComCasos', () => {
  let uc: CruzarFocoNovoComCasos;
  let queryRaw: jest.Mock;
  let executeRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    executeRaw = jest.fn();
    uc = new CruzarFocoNovoComCasos({
      client: { $queryRaw: queryRaw, $executeRaw: executeRaw },
    } as never);
  });

  it('não faz nada sem origemLevantamentoItemId', async () => {
    const r = await uc.execute({
      focoId: 'f1',
      clienteId: 'cli1',
      origemLevantamentoItemId: null,
      latitude: -23.5,
      longitude: -46.6,
    });
    expect(r.cruzamentos).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('não faz nada sem lat/lng', async () => {
    const r = await uc.execute({
      focoId: 'f1',
      clienteId: 'cli1',
      origemLevantamentoItemId: 'li1',
      latitude: null,
      longitude: null,
    });
    expect(r.cruzamentos).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('retorna 0 quando nenhum caso está no raio', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const r = await uc.execute({
      focoId: 'f1',
      clienteId: 'cli1',
      origemLevantamentoItemId: 'li1',
      latitude: -23.5,
      longitude: -46.6,
    });
    expect(r.cruzamentos).toBe(0);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('insere cruzamentos e atualiza foco com casos próximos', async () => {
    queryRaw.mockResolvedValueOnce([
      { id: 'c1', distancia_metros: 150 },
      { id: 'c2', distancia_metros: 220 },
    ]);
    // 2 inserts + 1 update
    executeRaw
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const r = await uc.execute({
      focoId: 'f1',
      clienteId: 'cli1',
      origemLevantamentoItemId: 'li1',
      latitude: -23.5,
      longitude: -46.6,
    });

    expect(r.cruzamentos).toBe(2);
    expect(executeRaw).toHaveBeenCalledTimes(3);
  });
});
