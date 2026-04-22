import { CriarFocoDeLevantamentoItem } from '../criar-foco-de-levantamento-item';

type Mock = jest.Mock;

const mkPrisma = () => {
  const findUnique: Mock = jest.fn();
  const queryRaw: Mock = jest.fn();
  const create: Mock = jest.fn();
  return {
    findUnique,
    queryRaw,
    create,
    service: {
      client: {
        levantamentos: { findUnique },
        focos_risco: { create },
        $queryRaw: queryRaw,
      },
    } as any,
  };
};

const mkCruzar = () => ({
  execute: jest.fn().mockResolvedValue({ cruzamentos: 0 }),
} as any);

const baseInput = {
  itemId: 'it-1',
  levantamentoId: 'lev-1',
  latitude: -23.5,
  longitude: -46.6,
  prioridade: 'P2',
  risco: 'médio',
  enderecoCurto: 'Rua A',
  payload: null,
  createdAt: new Date('2026-04-20T12:00:00Z'),
};

describe('CriarFocoDeLevantamentoItem', () => {
  let useCase: CriarFocoDeLevantamentoItem;
  let p: ReturnType<typeof mkPrisma>;
  let c: ReturnType<typeof mkCruzar>;

  beforeEach(() => {
    p = mkPrisma();
    c = mkCruzar();
    useCase = new CriarFocoDeLevantamentoItem(p.service, c);
    p.queryRaw.mockResolvedValue([]);
    p.create.mockResolvedValue({
      id: 'foco-1',
      cliente_id: 'cli-1',
      origem_levantamento_item_id: 'it-1',
      latitude: -23.5,
      longitude: -46.6,
    });
  });

  it('retorna levantamento_nao_encontrado quando levantamento inexistente', async () => {
    p.findUnique.mockResolvedValue(null);
    const r = await useCase.execute(baseInput);
    expect(r).toEqual({ criado: false, motivo: 'levantamento_nao_encontrado' });
    expect(p.create).not.toHaveBeenCalled();
  });

  it('cidadão com prioridade P5 e risco baixo SEMPRE cria foco com origem cidadao', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'MANUAL' });
    await useCase.execute({
      ...baseInput,
      prioridade: 'P5',
      risco: 'baixo',
      payload: { fonte: 'cidadao' },
    });
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origem_tipo: 'cidadao' }),
      }),
    );
  });

  it('item não-cidadão com P4 e risco baixo → filtro_nao_atendido', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    const r = await useCase.execute({
      ...baseInput,
      prioridade: 'P4',
      risco: 'baixo',
    });
    expect(r).toEqual({ criado: false, motivo: 'filtro_nao_atendido' });
    expect(p.create).not.toHaveBeenCalled();
  });

  it('item não-cidadão com P2 → passa filtro', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    const r = await useCase.execute({ ...baseInput, prioridade: 'P2', risco: 'baixo' });
    expect(r.criado).toBe(true);
  });

  it('item não-cidadão com P5 mas risco Crítico → passa filtro', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    const r = await useCase.execute({
      ...baseInput,
      prioridade: 'P5',
      risco: 'Crítico',
    });
    expect(r.criado).toBe(true);
  });

  it('com coords e imóvel próximo → $queryRaw chamado e imovel_id preenchido', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    p.queryRaw.mockResolvedValue([{ id: 'imo-7' }]);
    await useCase.execute(baseInput);
    expect(p.queryRaw).toHaveBeenCalled();
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imovel_id: 'imo-7' }),
      }),
    );
  });

  it('sem coords → NÃO chama $queryRaw, imovel_id fica null', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    await useCase.execute({ ...baseInput, latitude: null, longitude: null });
    expect(p.queryRaw).not.toHaveBeenCalled();
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imovel_id: null }),
      }),
    );
  });

  it('levantamento DRONE não-cidadão → origem_tipo=drone', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    await useCase.execute(baseInput);
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origem_tipo: 'drone' }),
      }),
    );
  });

  it('levantamento MANUAL não-cidadão → origem_tipo=agente', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'manual' });
    await useCase.execute(baseInput);
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origem_tipo: 'agente' }),
      }),
    );
  });

  it('prioridade Crítica é normalizada para P1', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    await useCase.execute({ ...baseInput, prioridade: 'Crítica', risco: 'alto' });
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prioridade: 'P1' }),
      }),
    );
  });

  it('status nasce em_triagem', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    await useCase.execute(baseInput);
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'em_triagem' }),
      }),
    );
  });

  it('origem_levantamento_item_id preenchido com o item', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    await useCase.execute(baseInput);
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origem_levantamento_item_id: 'it-1' }),
      }),
    );
  });

  it('chama CruzarFocoNovoComCasos após criar foco', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    await useCase.execute(baseInput);
    expect(c.execute).toHaveBeenCalledWith({
      focoId: 'foco-1',
      clienteId: 'cli-1',
      origemLevantamentoItemId: 'it-1',
      latitude: -23.5,
      longitude: -46.6,
    });
  });

  it('autoClassificarFoco: levantamento DRONE → classificacao_inicial=foco', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    await useCase.execute(baseInput);
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ classificacao_inicial: 'foco' }),
      }),
    );
  });

  it('autoClassificarFoco: levantamento manual cidadão → classificacao_inicial=suspeito', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'MANUAL' });
    await useCase.execute({ ...baseInput, payload: { fonte: 'cidadao' } });
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ classificacao_inicial: 'suspeito' }),
      }),
    );
  });

  it('falha no CruzarFocoNovoComCasos não reverte criação do foco', async () => {
    p.findUnique.mockResolvedValue({ cliente_id: 'cli-1', tipo_entrada: 'DRONE' });
    c.execute.mockRejectedValue(new Error('boom'));
    const r = await useCase.execute(baseInput);
    expect(r).toEqual({ criado: true, focoId: 'foco-1' });
  });
});
