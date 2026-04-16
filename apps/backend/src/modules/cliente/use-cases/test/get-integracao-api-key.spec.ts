import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClienteException } from '../../errors/cliente.exception';
import {
  ClienteIntegracaoApiKey,
  ClienteReadRepository,
} from '../../repositories/cliente-read.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { GetIntegracaoApiKey } from '../get-integracao-api-key';

describe('GetIntegracaoApiKey', () => {
  let useCase: GetIntegracaoApiKey;
  const readRepo = mock<ClienteReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetIntegracaoApiKey, { provide: ClienteReadRepository, useValue: readRepo }],
    }).compile();
    useCase = module.get<GetIntegracaoApiKey>(GetIntegracaoApiKey);
  });

  it('deve retornar integração encontrada', async () => {
    const integracao: ClienteIntegracaoApiKey = {
      id: 'int-1',
      clienteId: 'c-1',
      tipo: 'externo',
      apiKey: 'secret',
      apiKeyMasked: 'sec***',
      ativo: true,
      ambiente: 'prod',
    };
    readRepo.findIntegracaoApiKey.mockResolvedValue(integracao);

    const result = await useCase.execute('int-1');

    expect(readRepo.findIntegracaoApiKey).toHaveBeenCalledWith('int-1');
    expect(result.integracao).toBe(integracao);
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findIntegracaoApiKey.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('nao-existe'), ClienteException.notFound());
  });
});
