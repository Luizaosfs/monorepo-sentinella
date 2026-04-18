import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { BillingCiclo } from '../../entities/billing';
import { BillingWriteRepository } from '../../repositories/billing-write.repository';
import { CreateCiclo } from '../create-ciclo';

describe('CreateCiclo', () => {
  let useCase: CreateCiclo;
  const writeRepo = mock<BillingWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCiclo,
        { provide: BillingWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<CreateCiclo>(CreateCiclo);
  });

  it('deve criar ciclo com status=aberto e valorExcedente=0', async () => {
    const entity = new BillingCiclo(
      {
        clienteId: 'cli-1',
        periodoInicio: new Date('2025-06-01'),
        periodoFim: new Date('2025-06-30'),
        status: 'aberto',
        valorBase: 1000,
        valorExcedente: 0,
      },
      {},
    );
    writeRepo.createCiclo.mockResolvedValue(entity);

    const result = await useCase.execute({
      clienteId: 'cli-1',
      periodoInicio: new Date('2025-06-01'),
      periodoFim: new Date('2025-06-30'),
      valorBase: 1000,
    });

    expect(result.ciclo.status).toBe('aberto');
    expect(result.ciclo.valorExcedente).toBe(0);
    expect(writeRepo.createCiclo).toHaveBeenCalledTimes(1);
  });

  it('deve propagar erro do repository', async () => {
    writeRepo.createCiclo.mockRejectedValue(new Error('db-fail'));

    await expect(
      useCase.execute({
        clienteId: 'cli-1',
        periodoInicio: new Date('2025-06-01'),
        periodoFim: new Date('2025-06-30'),
      }),
    ).rejects.toThrow('db-fail');
  });
});
