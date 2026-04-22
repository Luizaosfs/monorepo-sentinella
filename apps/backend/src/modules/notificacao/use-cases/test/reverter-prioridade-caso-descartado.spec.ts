import { ReverterPrioridadeCasoDescartado } from '../reverter-prioridade-caso-descartado';

describe('ReverterPrioridadeCasoDescartado', () => {
  let uc: ReverterPrioridadeCasoDescartado;
  let executeRaw: jest.Mock;

  beforeEach(() => {
    executeRaw = jest.fn();
    uc = new ReverterPrioridadeCasoDescartado({
      client: { $executeRaw: executeRaw },
    } as never);
  });

  it('não faz nada quando statusNovo != descartado', async () => {
    const r = await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      statusAnterior: 'suspeito',
      statusNovo: 'confirmado',
    });
    expect(r.aplicado).toBe(false);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('não faz nada quando já estava descartado (idempotência)', async () => {
    const r = await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      statusAnterior: 'descartado',
      statusNovo: 'descartado',
    });
    expect(r.aplicado).toBe(false);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('apaga cruzamentos e reverte prioridade do foco na transição PARA descartado', async () => {
    executeRaw
      .mockResolvedValueOnce(2) // delete cruzamento
      .mockResolvedValueOnce(2); // update focos

    const r = await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      statusAnterior: 'confirmado',
      statusNovo: 'descartado',
    });

    expect(r.aplicado).toBe(true);
    expect(r.focosAfetados).toBe(2);
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  it('UPDATE restaura prioridade via COALESCE(prioridade_original_antes_caso, prioridade)', async () => {
    executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      statusAnterior: 'confirmado',
      statusNovo: 'descartado',
    });

    // a segunda chamada é o UPDATE focos_risco
    const updateSql = executeRaw.mock.calls[1][0];
    const joined = updateSql.strings.join('?');

    expect(joined).toMatch(/prioridade\s*=\s*COALESCE\(prioridade_original_antes_caso,\s*prioridade\)/);
    expect(joined).toMatch(/prioridade_original_antes_caso\s*=\s*NULL/);
    expect(joined).toMatch(/array_remove\(casos_ids/);
    expect(joined).toMatch(/updated_at\s*=\s*now\(\)/);
  });

  it('UPDATE filtra focos em estado terminal (resolvido/descartado)', async () => {
    executeRaw.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    await uc.execute({
      casoId: 'c1',
      clienteId: 'cli1',
      statusAnterior: 'confirmado',
      statusNovo: 'descartado',
    });

    const updateSql = executeRaw.mock.calls[1][0];
    const joined = updateSql.strings.join('?');

    expect(joined).toMatch(/status\s+NOT IN\s*\(\s*'resolvido'\s*,\s*'descartado'\s*\)/);
  });
});
