import { CreateAgrupamento } from '../create-agrupamento';

describe('CreateAgrupamento', () => {
  it('cria agrupamento com nome, tipo e uf', async () => {
    const created = { id: 'a1', nome: 'Regional Sul', tipo: 'regional', uf: 'RS' };
    const create  = jest.fn().mockResolvedValue(created);
    const uc = new CreateAgrupamento({ client: { agrupamento_regional: { create } } } as never);

    const result = await uc.execute({ nome: 'Regional Sul', tipo: 'regional', uf: 'RS' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nome: 'Regional Sul', uf: 'RS' }) }),
    );
    expect(result).toEqual(created);
  });
});
