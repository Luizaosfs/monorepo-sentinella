import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

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
      ],
    }).compile();

    useCase = module.get<CreateRun>(CreateRun);
  });

  it('deve criar run usando clienteId passado explicitamente pelo controller', async () => {
    const created = new PluvioRunBuilder().withClienteId('test-cliente-id').build();
    writeRepo.createRun.mockResolvedValue(created);

    const input = {
      clienteId: 'ignorado-use-case-usa-param',
      dtRef: new Date('2024-06-15'),
      totalBairros: 10,
      status: 'pendente',
    } as CreatePluvioRunInput;

    await useCase.execute(input, 'test-cliente-id');

    expect(writeRepo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });

  it('deve usar clienteId do parâmetro, não do body (isolamento de tenant)', async () => {
    const created = new PluvioRunBuilder().withClienteId('tenant-correto').build();
    writeRepo.createRun.mockResolvedValue(created);

    await useCase.execute(
      {
        clienteId: 'cliente-do-body-ignorado',
        dtRef: new Date('2024-06-20'),
        totalBairros: 20,
        status: 'pendente',
      } as CreatePluvioRunInput,
      'tenant-correto',
    );

    expect(writeRepo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'tenant-correto' }),
    );
  });

  it('deve usar status padrão pendente quando não fornecido', async () => {
    const created = new PluvioRunBuilder().withStatus('pendente').build();
    writeRepo.createRun.mockResolvedValue(created);

    await useCase.execute(
      {
        dtRef: new Date('2024-06-15'),
        totalBairros: 0,
        status: undefined,
      } as unknown as CreatePluvioRunInput,
      'test-cliente-id',
    );

    expect(writeRepo.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pendente' }),
    );
  });
});
