import { ListarLogCnes } from '../listar-log-cnes';

describe('ListarLogCnes', () => {
  it('retorna logs do cliente ordenados por created_at desc', async () => {
    const logs = [{ id: 'l1', acao: 'upsert' }];
    const findMany = jest.fn().mockResolvedValue(logs);
    const uc = new ListarLogCnes({ client: { unidades_saude_sync_log: { findMany } } } as never);

    const result = await uc.execute('cliente-a');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cliente_id: 'cliente-a' },
        orderBy: [{ created_at: 'desc' }],
        take: 100,
      }),
    );
    expect(result).toEqual(logs);
  });

  it('filtra por controleId quando fornecido', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const uc = new ListarLogCnes({ client: { unidades_saude_sync_log: { findMany } } } as never);

    await uc.execute('cliente-a', 'ctrl-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cliente_id: 'cliente-a', controle_id: 'ctrl-1' } }),
    );
  });
});
