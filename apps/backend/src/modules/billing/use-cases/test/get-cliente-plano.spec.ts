import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClientePlano } from '../../entities/billing';
import { BillingException } from '../../errors/billing.exception';
import { BillingReadRepository } from '../../repositories/billing-read.repository';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { GetClientePlano } from '../get-cliente-plano';

describe('GetClientePlano', () => {
  let useCase: GetClientePlano;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetClientePlano,
        { provide: BillingReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<GetClientePlano>(GetClientePlano);
  });

  it('deve retornar clientePlano quando existe', async () => {
    const cp = new ClientePlano(
      {
        clienteId: 'cli-1',
        planoId: 'plano-1',
        dataInicio: new Date(),
        status: 'ativo',
      },
      {},
    );
    readRepo.findClientePlano.mockResolvedValue(cp);

    const result = await useCase.execute('cli-1');

    expect(result.clientePlano).toBe(cp);
  });

  it('deve lançar clientePlanoNotFound quando não encontrado', async () => {
    readRepo.findClientePlano.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('cli-inexistente'),
      BillingException.clientePlanoNotFound(),
    );
  });
});
