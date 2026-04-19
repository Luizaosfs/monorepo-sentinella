import { GetIntegracoes } from '../get-integracoes';

describe('GetIntegracoes', () => {
  it('retorna integrações sem api_key (select restrito)', async () => {
    const integracoes = [{ id: 'i1', tipo: 'esus_notifica', ativo: true }];
    const findMany = jest.fn().mockResolvedValue(integracoes);
    const uc = new GetIntegracoes({ client: { cliente_integracoes: { findMany } } } as never);

    const result = await uc.execute('cliente-a');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cliente_id: 'cliente-a' },
        select: expect.not.objectContaining({ api_key: expect.anything() }),
      }),
    );
    expect(result).toEqual(integracoes);
  });
});
