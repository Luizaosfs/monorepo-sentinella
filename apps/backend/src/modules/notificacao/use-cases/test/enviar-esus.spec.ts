import { EnviarEsus } from '../enviar-esus';

const mockIntegracoes = { findFirst: jest.fn() };
const mockEsus = { create: jest.fn(), update: jest.fn() };
const mockPrisma = {
  client: {
    cliente_integracoes: mockIntegracoes,
    item_notificacoes_esus: mockEsus,
  },
};

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

const mockIntegracao = {
  id: 'integ-1',
  cliente_id: 'cliente-1',
  api_key: 'test-key',
  endpoint_url: 'https://notifica.saude.gov.br/api/notificacoes',
  ambiente: 'homologacao',
  codigo_ibge: '3550308',
  unidade_saude_cnes: '1234567',
  ativo: true,
};

const mockRegistro = { id: 'notif-1', status: 'pendente' };

const baseInput = {
  levantamentoItemId: 'item-1',
  tipoAgravo: 'dengue' as const,
  enderecoCompleto: 'Rua A, 100',
  enderecoCurto: 'Rua A',
  latitude: -23.5,
  longitude: -46.6,
  dataHora: '2026-04-19T10:00:00Z',
  dataInicioSintomas: '2026-04-15',
};

describe('EnviarEsus', () => {
  let useCase: EnviarEsus;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new EnviarEsus(mockPrisma as any);
    mockIntegracoes.findFirst.mockResolvedValue(mockIntegracao);
    mockEsus.create.mockResolvedValue(mockRegistro);
    mockEsus.update.mockResolvedValue({ ...mockRegistro, status: 'enviado' });
  });

  it('deve enviar com sucesso e atualizar para status enviado', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'esus-numero-001' }),
    } as Response);

    const result = await useCase.execute('cliente-1', baseInput, 'usuario-1');

    expect(mockEsus.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pendente', tipo_agravo: 'dengue' }) }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      mockIntegracao.endpoint_url,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-key' }),
      }),
    );
    expect(mockEsus.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'enviado', numero_notificacao: 'esus-numero-001' }) }),
    );
    expect(result).toMatchObject({ status: 'enviado' });
  });

  it('deve atualizar para erro quando API retorna status não-ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Payload inválido' }),
    } as Response);

    await expect(useCase.execute('cliente-1', baseInput)).rejects.toThrow('Payload inválido');

    expect(mockEsus.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'erro', erro_mensagem: 'Payload inválido' }) }),
    );
  });

  it('deve atualizar para erro quando fetch lança exceção (network/timeout)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    await expect(useCase.execute('cliente-1', baseInput)).rejects.toThrow('network error');

    expect(mockEsus.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'erro', erro_mensagem: 'network error' }) }),
    );
  });

  it('deve lançar erro quando integração não está configurada', async () => {
    mockIntegracoes.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('cliente-1', baseInput)).rejects.toThrow('Integração e-SUS não configurada');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockEsus.create).not.toHaveBeenCalled();
  });
});
