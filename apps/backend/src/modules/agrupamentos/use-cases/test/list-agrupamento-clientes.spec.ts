import { ListAgrupamentoClientes } from '../list-agrupamento-clientes';

describe('ListAgrupamentoClientes', () => {
  it('retorna clientes do agrupamento via two-step lookup', async () => {
    const junctions = [{ cliente_id: 'c1' }, { cliente_id: 'c2' }];
    const clientes  = [{ id: 'c1', nome: 'Mun A' }, { id: 'c2', nome: 'Mun B' }];
    const findManyJunction = jest.fn().mockResolvedValue(junctions);
    const findManyClientes = jest.fn().mockResolvedValue(clientes);

    const uc = new ListAgrupamentoClientes({
      client: {
        agrupamento_cliente: { findMany: findManyJunction },
        clientes: { findMany: findManyClientes },
      },
    } as never);

    const result = await uc.execute('a1');

    expect(findManyJunction).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agrupamento_id: 'a1' } }),
    );
    expect(findManyClientes).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['c1', 'c2'] } }) }),
    );
    expect(result).toEqual(clientes);
  });

  it('retorna array vazio quando agrupamento não tem clientes', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const uc = new ListAgrupamentoClientes({
      client: { agrupamento_cliente: { findMany } },
    } as never);

    const result = await uc.execute('a1');
    expect(result).toEqual([]);
  });
});
