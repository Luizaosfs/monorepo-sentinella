import { ReenviarEsus } from '../reenviar-esus';

const mockIntegracoes = { findFirst: jest.fn() };
const mockEsus = { findFirst: jest.fn(), update: jest.fn() };
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
  ativo: true,
};

const mockRegistro = {
  id: 'notif-1',
  cliente_id: 'cliente-1',
  status: 'erro',
  payload_enviado: {
    codigoMunicipio: '3550308',
    dataNotificacao: '2026-04-19',
    agravo: 'A90',
  },
};

describe('ReenviarEsus', () => {
  let useCase: ReenviarEsus;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ReenviarEsus(mockPrisma as any);
    mockEsus.findFirst.mockResolvedValue(mockRegistro);
    mockIntegracoes.findFirst.mockResolvedValue(mockIntegracao);
    mockEsus.update.mockResolvedValue({ ...mockRegistro, status: 'enviado' });
  });

  it('deve reenviar com sucesso e atualizar para enviado', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'esus-numero-002' }),
    } as Response);

    await useCase.execute('notif-1', 'cliente-1');

    expect(mockEsus.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pendente' }) }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      mockIntegracao.endpoint_url,
      expect.objectContaining({ headers: expect.objectContaining({ 'Authorization': 'Bearer test-key' }) }),
    );
    expect(mockEsus.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'enviado' }) }),
    );
  });

  it('deve atualizar para erro quando API retorna status não-ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal error' }),
    } as Response);

    await expect(useCase.execute('notif-1', 'cliente-1')).rejects.toThrow('Internal error');

    expect(mockEsus.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'erro', erro_mensagem: 'Internal error' }) }),
    );
  });

  it('deve lançar erro quando registro não existe', async () => {
    mockEsus.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('notif-inexistente', 'cliente-1')).rejects.toThrow('Notificação não encontrada');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('deve lançar erro quando integração não está configurada', async () => {
    mockIntegracoes.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('notif-1', 'cliente-1')).rejects.toThrow('Integração e-SUS não configurada');

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
