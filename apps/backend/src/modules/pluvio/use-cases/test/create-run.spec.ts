import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';

import { CreatePluvioRunInput } from '../../dtos/create-pluvio-run.body';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { CreateRun } from '../create-run';
import { PluvioRunBuilder } from './builders/pluvio.builder';

describe('CreateRun', () => {
  let useCase: CreateRun;
  const writeRepo = mock<PluvioWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateRun,
        { provide: PluvioWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<CreateRun>(CreateRun);
  });

  it('deve criar run com clienteId do input ou fallback tenant', async () => {
    const created = new PluvioRunBuilder().withClienteId('test-cliente-id').build();
    writeRepo.createRun.mockResolvedValue(created);

    const explicit = {
      clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      dtRef: new Date('2024-06-15'),
      totalBairros: 10,
      status: 'pendente',
    } as CreatePluvioRunInput;
    await useCase.execute(explicit);

    expect(writeRepo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );

    writeRepo.createRun.mockResolvedValue(new PluvioRunBuilder().build());
    const fallbackInput = {
      clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      dtRef: new Date('2024-06-20'),
      totalBairros: 20,
      status: 'pendente',
    } as CreatePluvioRunInput;

    await useCase.execute(fallbackInput);

    expect(writeRepo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });

  it('deve usar status padrão pendente', async () => {
    const created = new PluvioRunBuilder().withStatus('pendente').build();
    writeRepo.createRun.mockResolvedValue(created);

    await useCase.execute({
      clienteId: 'test-cliente-id',
      dtRef: new Date('2024-06-15'),
      totalBairros: 0,
      status: 'pendente',
    } as CreatePluvioRunInput);

    expect(writeRepo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pendente' }),
    );
  });
});
