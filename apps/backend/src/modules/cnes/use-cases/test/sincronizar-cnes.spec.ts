import { SincronizarCnes } from '../sincronizar-cnes';

describe('SincronizarCnes', () => {
  const makeControle = (id = 'ctrl-1') => ({ id });
  const cnesService = { sync: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('cria controle, chama sync e atualiza status concluido', async () => {
    const create = jest.fn().mockResolvedValue(makeControle());
    const update = jest.fn().mockResolvedValue({});
    cnesService.sync.mockResolvedValue({ clientes: 1, upserts: 5 });

    const uc = new SincronizarCnes(
      { client: { unidades_saude_sync_controle: { create, update } } } as never,
      cnesService as never,
    );

    const result = await uc.execute('c1');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'em_andamento', origem_execucao: 'manual' }) }),
    );
    expect(cnesService.sync).toHaveBeenCalledWith('c1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'concluido' }) }),
    );
    expect(result).toMatchObject({ controle_id: 'ctrl-1', status: 'concluido' });
  });

  it('atualiza controle com status=erro quando sync lança exceção', async () => {
    const create = jest.fn().mockResolvedValue(makeControle());
    const update = jest.fn().mockResolvedValue({});
    cnesService.sync.mockRejectedValue(new Error('timeout'));

    const uc = new SincronizarCnes(
      { client: { unidades_saude_sync_controle: { create, update } } } as never,
      cnesService as never,
    );

    await expect(uc.execute('c1')).rejects.toThrow('timeout');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'erro' }) }),
    );
  });
});
