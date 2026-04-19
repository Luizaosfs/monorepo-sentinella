import { ListBillingResumo } from '../list-billing-resumo';

describe('ListBillingResumo', () => {
  it('retorna resultado da query raw', async () => {
    const row = { cliente_id: 'c1', nome: 'Município A', vistorias_mes: 10 };
    const queryRaw = jest.fn().mockResolvedValue([row]);
    const uc = new ListBillingResumo({ client: { $queryRaw: queryRaw } } as never);

    const result = await uc.execute();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([row]);
  });
});
