import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClientePlano } from '../../entities/billing';
import { BillingWriteRepository } from '../../repositories/billing-write.repository';
import { CreateClientePlano } from '../create-cliente-plano';

describe('CreateClientePlano', () => {
  let useCase: CreateClientePlano;
  const writeRepo = mock<BillingWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateClientePlano,
        { provide: BillingWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<CreateClientePlano>(CreateClientePlano);
  });

  it('deve criar clientePlano com status=ativo default', async () => {
    const entity = new ClientePlano(
      {
        clienteId: 'cli-1',
        planoId: 'plano-1',
        dataInicio: new Date('2025-06-01'),
        status: 'ativo',
      },
      {},
    );
    writeRepo.createClientePlano.mockResolvedValue(entity);

    const result = await useCase.execute({
      clienteId: 'cli-1',
      planoId: 'plano-1',
      dataInicio: new Date('2025-06-01'),
      status: 'ativo',
    } as any);

    expect(result.clientePlano.status).toBe('ativo');
    expect(writeRepo.createClientePlano).toHaveBeenCalledTimes(1);
  });

  it('deve propagar erro do repository', async () => {
    writeRepo.createClientePlano.mockRejectedValue(new Error('duplicate'));

    await expect(
      useCase.execute({
        clienteId: 'cli-1',
        planoId: 'plano-1',
      } as any),
    ).rejects.toThrow('duplicate');
  });
});
