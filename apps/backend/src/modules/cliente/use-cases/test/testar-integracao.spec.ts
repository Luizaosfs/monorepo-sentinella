import { TestarIntegracao } from '../testar-integracao';

describe('TestarIntegracao', () => {
  it('retorna sucesso=false quando não há integração ativa', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const uc = new TestarIntegracao({ client: { cliente_integracoes: { findFirst } } } as never);

    const result = await uc.execute('c1');

    expect(result.sucesso).toBe(false);
    expect(result.erro).toMatch(/nenhuma integração ativa/i);
  });

  it('retorna sucesso=true quando endpoint responde OK', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1', api_key: 'key', endpoint_url: 'https://api.test', ambiente: 'homologacao',
    });
    const uc = new TestarIntegracao({ client: { cliente_integracoes: { findFirst } } } as never);

    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as any;

    const result = await uc.execute('c1');

    expect(result.sucesso).toBe(true);
  });

  it('retorna sucesso=false com erro HTTP quando endpoint retorna 4xx', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1', api_key: 'key', endpoint_url: 'https://api.test', ambiente: 'homologacao',
    });
    const uc = new TestarIntegracao({ client: { cliente_integracoes: { findFirst } } } as never);

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' }) as any;

    const result = await uc.execute('c1');

    expect(result.sucesso).toBe(false);
    expect(result.erro).toContain('401');
  });
});
