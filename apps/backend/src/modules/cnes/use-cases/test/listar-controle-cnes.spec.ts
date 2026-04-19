import { ListarControleCnes } from '../listar-controle-cnes';

describe('ListarControleCnes', () => {
  it('retorna últimos 20 controles do cliente ordenados por iniciado_em desc', async () => {
    const controles = [{ id: 'c1', status: 'concluido' }];
    const findMany = jest.fn().mockResolvedValue(controles);
    const uc = new ListarControleCnes({
      client: { unidades_saude_sync_controle: { findMany } },
    } as never);

    const result = await uc.execute('cliente-a');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cliente_id: 'cliente-a' },
        orderBy: [{ iniciado_em: 'desc' }],
        take: 20,
      }),
    );
    expect(result).toEqual(controles);
  });
});
