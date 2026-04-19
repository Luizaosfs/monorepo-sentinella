import { ListTags } from '../list-tags';

describe('ListTags', () => {
  it('filtra por clienteId OU null quando clienteId fornecido', async () => {
    const tags = [{ id: 't1', slug: 'aedes', cliente_id: 'c1' }];
    const findMany = jest.fn().mockResolvedValue(tags);
    const uc = new ListTags({ client: { tags: { findMany } } } as never);

    const result = await uc.execute('c1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ cliente_id: 'c1' }, { cliente_id: null }] },
        orderBy: [{ slug: 'asc' }],
      }),
    );
    expect(result).toEqual(tags);
  });

  it('retorna todas as tags quando clienteId não fornecido (admin)', async () => {
    const tags = [{ id: 't1', slug: 'global', cliente_id: null }];
    const findMany = jest.fn().mockResolvedValue(tags);
    const uc = new ListTags({ client: { tags: { findMany } } } as never);

    await uc.execute(undefined);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
