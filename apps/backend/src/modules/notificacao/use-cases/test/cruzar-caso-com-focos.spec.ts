import { CruzarCasoComFocos } from '../cruzar-caso-com-focos';

describe('CruzarCasoComFocos', () => {
  let uc: CruzarCasoComFocos;
  let queryRaw: jest.Mock;
  let executeRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    executeRaw = jest.fn();
    uc = new CruzarCasoComFocos({
      client: { $queryRaw: queryRaw, $executeRaw: executeRaw },
    } as never);
  });

  it('retorna 0 e não consulta DB quando lat/lng são nulos', async () => {
    const r = await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      latitude: null,
      longitude: null,
    });
    expect(r.cruzamentos).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('retorna 0 quando nenhum foco está no raio', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const r = await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      latitude: -23.5,
      longitude: -46.6,
    });
    expect(r.cruzamentos).toBe(0);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('insere cruzamento e atualiza foco quando há focos próximos', async () => {
    queryRaw.mockResolvedValueOnce([
      { id: 'f1', levantamento_item_id: 'li1', distancia_metros: 120, prioridade: 'P3' },
    ]);
    executeRaw.mockResolvedValue(1);

    const r = await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      latitude: -23.5,
      longitude: -46.6,
    });

    expect(r.cruzamentos).toBe(1);
    // 1 insert + 1 update = 2 execRaw calls
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it('lida com múltiplos focos (um insere, outro já existente)', async () => {
    queryRaw.mockResolvedValueOnce([
      { id: 'f1', levantamento_item_id: 'li1', distancia_metros: 80, prioridade: 'P3' },
      { id: 'f2', levantamento_item_id: 'li2', distancia_metros: 200, prioridade: 'P1' },
    ]);
    // primeiro insert: 1 linha; update: 1; segundo insert: 0 (conflict); update: 0 (já P1)
    executeRaw
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const r = await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      latitude: -23.5,
      longitude: -46.6,
    });

    expect(r.cruzamentos).toBe(1);
    expect(executeRaw).toHaveBeenCalledTimes(4);
  });
});
