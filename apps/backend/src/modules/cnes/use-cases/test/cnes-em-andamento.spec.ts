import { CnesEmAndamento } from '../cnes-em-andamento';

describe('CnesEmAndamento', () => {
  it('retorna em_andamento=true quando há controle em andamento', async () => {
    const controle = { id: 'c1', status: 'em_andamento' };
    const findFirst = jest.fn().mockResolvedValue(controle);
    const uc = new CnesEmAndamento({ client: { unidades_saude_sync_controle: { findFirst } } } as never);

    const result = await uc.execute('cliente-a');

    expect(result).toEqual({ em_andamento: true, controle });
  });

  it('retorna em_andamento=false quando não há controle em andamento', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const uc = new CnesEmAndamento({ client: { unidades_saude_sync_controle: { findFirst } } } as never);

    const result = await uc.execute('cliente-a');

    expect(result).toEqual({ em_andamento: false, controle: undefined });
  });
});
