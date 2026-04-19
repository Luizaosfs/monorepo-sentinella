import { FilterAgrupamentos } from '../filter-agrupamentos';

describe('FilterAgrupamentos', () => {
  it('retorna apenas agrupamentos ativos ordenados por nome', async () => {
    const lista = [{ id: 'a1', nome: 'Regional Norte', ativo: true }];
    const findMany = jest.fn().mockResolvedValue(lista);
    const uc = new FilterAgrupamentos({ client: { agrupamento_regional: { findMany } } } as never);

    const result = await uc.execute();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true }, orderBy: [{ nome: 'asc' }] }),
    );
    expect(result).toEqual(lista);
  });
});
