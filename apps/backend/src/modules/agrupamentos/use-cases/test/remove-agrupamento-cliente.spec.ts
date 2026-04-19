import { RemoveAgrupamentoCliente } from '../remove-agrupamento-cliente';

describe('RemoveAgrupamentoCliente', () => {
  it('deleta pelo composite PK agrupamento_id_cliente_id', async () => {
    const del = jest.fn().mockResolvedValue({});
    const uc = new RemoveAgrupamentoCliente({ client: { agrupamento_cliente: { delete: del } } } as never);

    await uc.execute('a1', 'c1');

    expect(del).toHaveBeenCalledWith({
      where: { agrupamento_id_cliente_id: { agrupamento_id: 'a1', cliente_id: 'c1' } },
    });
  });
});
