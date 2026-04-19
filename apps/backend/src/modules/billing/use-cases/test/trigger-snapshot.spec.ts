import { TriggerSnapshot } from '../trigger-snapshot';

describe('TriggerSnapshot', () => {
  const makeCount = (n: number) => jest.fn().mockResolvedValue(n);
  const makeCreate = (snapshot: object) => jest.fn().mockResolvedValue(snapshot);

  it('cria snapshot com contagens do período corrente para o cliente', async () => {
    const snapshot = { id: 'snap-1', cliente_id: 'c1' };
    const count = makeCount(5);
    const create = makeCreate(snapshot);

    const uc = new TriggerSnapshot({
      client: {
        vistorias:          { count },
        levantamentos:      { count },
        levantamento_itens: { count },
        voos:               { count },
        casos_notificados:  { count },
        usuarios:           { count },
        imoveis:            { count },
        billing_usage_snapshot: { create },
      },
    } as never);

    const result = await uc.execute('c1');

    expect(count).toHaveBeenCalledTimes(7);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cliente_id: 'c1' }) }),
    );
    expect(result).toEqual(snapshot);
  });
});
