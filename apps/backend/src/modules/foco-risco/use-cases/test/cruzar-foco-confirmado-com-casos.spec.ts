import { CruzarFocoConfirmadoComCasos } from '../cruzar-foco-confirmado-com-casos';

describe('CruzarFocoConfirmadoComCasos', () => {
  let uc: CruzarFocoConfirmadoComCasos;
  let queryRaw: jest.Mock;
  let executeRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    executeRaw = jest.fn();
    uc = new CruzarFocoConfirmadoComCasos({
      client: { $queryRaw: queryRaw, $executeRaw: executeRaw },
    } as never);
  });

  it('não faz nada sem focoId', async () => {
    const r = await uc.execute({ focoId: undefined, clienteId: 'cli1' });
    expect(r).toEqual({ cruzamentos: 0, casos: 0 });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('foco inexistente (ou de outro cliente) → não cruza', async () => {
    queryRaw.mockResolvedValueOnce([]); // resolve do foco
    const r = await uc.execute({ focoId: 'f1', clienteId: 'cli1' });
    expect(r).toEqual({ cruzamentos: 0, casos: 0 });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('foco confirmado sem coordenadas → não cruza', async () => {
    queryRaw.mockResolvedValueOnce([
      { latitude: null, longitude: null, origem_levantamento_item_id: null },
    ]);
    const r = await uc.execute({ focoId: 'f1', clienteId: 'cli1' });
    expect(r).toEqual({ cruzamentos: 0, casos: 0 });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('usa coordenadas do input quando a linha do foco não tem', async () => {
    queryRaw
      .mockResolvedValueOnce([
        { latitude: null, longitude: null, origem_levantamento_item_id: null },
      ])
      .mockResolvedValueOnce([]); // nenhum caso no raio
    const r = await uc.execute({
      focoId: 'f1',
      clienteId: 'cli1',
      latitude: -23.5,
      longitude: -46.6,
    });
    expect(r).toEqual({ cruzamentos: 0, casos: 0 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('a query de casos ignora descartados e deletados', async () => {
    queryRaw
      .mockResolvedValueOnce([
        { latitude: -23.5, longitude: -46.6, origem_levantamento_item_id: null },
      ])
      .mockResolvedValueOnce([]);
    await uc.execute({ focoId: 'f1', clienteId: 'cli1' });

    const casosSql = (queryRaw.mock.calls[1][0] as { strings: string[] }).strings.join(' ');
    expect(casosSql).toContain('deleted_at IS NULL');
    expect(casosSql).toContain("status <> 'descartado'");
  });

  it('insere por foco_risco_id com ON CONFLICT (caso_id, foco_risco_id) e eleva prioridade', async () => {
    queryRaw
      .mockResolvedValueOnce([
        { latitude: -23.5, longitude: -46.6, origem_levantamento_item_id: 'li1' },
      ])
      .mockResolvedValueOnce([
        { id: 'c1', distancia_metros: 120 },
        { id: 'c2', distancia_metros: 240 },
      ]);
    executeRaw
      .mockResolvedValueOnce(1) // insert c1
      .mockResolvedValueOnce(1) // insert c2
      .mockResolvedValueOnce(1); // update foco

    const r = await uc.execute({ focoId: 'f1', clienteId: 'cli1' });

    expect(r).toEqual({ cruzamentos: 2, casos: 2 });
    expect(executeRaw).toHaveBeenCalledTimes(3);

    const insertSql = (executeRaw.mock.calls[0][0] as { strings: string[] }).strings.join(' ');
    expect(insertSql).toContain('INSERT INTO caso_foco_cruzamento');
    expect(insertSql).toContain('caso_id, foco_risco_id, levantamento_item_id, distancia_metros');
    expect(insertSql).toContain('ON CONFLICT (caso_id, foco_risco_id) DO NOTHING');

    const updateSql = (executeRaw.mock.calls[2][0] as { strings: string[] }).strings.join(' ');
    expect(updateSql).toContain("prioridade = 'P1'");
    expect(updateSql).toContain("prioridade IS DISTINCT FROM 'P1'");
  });

  it('idempotência: ON CONFLICT não duplica (executeRaw=0) → cruzamentos=0 mas casos contabilizados', async () => {
    queryRaw
      .mockResolvedValueOnce([
        { latitude: -23.5, longitude: -46.6, origem_levantamento_item_id: null },
      ])
      .mockResolvedValueOnce([{ id: 'c1', distancia_metros: 100 }]);
    executeRaw
      .mockResolvedValueOnce(0) // insert ignorado (já existia)
      .mockResolvedValueOnce(1); // update foco

    const r = await uc.execute({ focoId: 'f1', clienteId: 'cli1' });

    expect(r).toEqual({ cruzamentos: 0, casos: 1 });
  });

  it('nenhum caso no raio → não escreve nada', async () => {
    queryRaw
      .mockResolvedValueOnce([
        { latitude: -23.5, longitude: -46.6, origem_levantamento_item_id: null },
      ])
      .mockResolvedValueOnce([]);
    const r = await uc.execute({ focoId: 'f1', clienteId: 'cli1' });
    expect(r).toEqual({ cruzamentos: 0, casos: 0 });
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
