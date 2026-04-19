import { AddAgrupamentoCliente } from '../add-agrupamento-cliente';

describe('AddAgrupamentoCliente', () => {
  it('cria junction agrupamento_id + cliente_id', async () => {
    const created = { agrupamento_id: 'a1', cliente_id: 'c1' };
    const create  = jest.fn().mockResolvedValue(created);
    const uc = new AddAgrupamentoCliente({ client: { agrupamento_cliente: { create } } } as never);

    const result = await uc.execute('a1', 'c1');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agrupamento_id: 'a1', cliente_id: 'c1' } }),
    );
    expect(result).toEqual(created);
  });
});
