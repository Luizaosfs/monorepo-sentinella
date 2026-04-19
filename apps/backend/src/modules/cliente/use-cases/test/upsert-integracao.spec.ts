import { UpsertIntegracao } from '../upsert-integracao';

const input = { tipo: 'esus_notifica', apiKey: 'key-1234567890' };

describe('UpsertIntegracao', () => {
  it('cria nova integração quando não existe registro para o tipo', async () => {
    const created = { id: 'i1', cliente_id: 'c1', tipo: 'esus_notifica' };
    const findFirst = jest.fn().mockResolvedValue(null);
    const create   = jest.fn().mockResolvedValue(created);
    const update   = jest.fn();
    const uc = new UpsertIntegracao({
      client: { cliente_integracoes: { findFirst, create, update } },
    } as never);

    const result = await uc.execute('c1', input);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cliente_id: 'c1', tipo: 'esus_notifica' }) }),
    );
    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('atualiza registro existente quando tipo já cadastrado', async () => {
    const existing = { id: 'i1' };
    const updated  = { id: 'i1', api_key: 'key-1234567890' };
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update    = jest.fn().mockResolvedValue(updated);
    const create    = jest.fn();
    const uc = new UpsertIntegracao({
      client: { cliente_integracoes: { findFirst, create, update } },
    } as never);

    const result = await uc.execute('c1', input);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i1' } }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual(updated);
  });
});
