import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CreateCicloBody } from '../../dtos/create-ciclo.body';
import { CicloWriteRepository } from '../../repositories/ciclo-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateCiclo } from '../create-ciclo';
import { CicloBuilder } from './builders/ciclo.builder';

describe('CreateCiclo', () => {
  let useCase: CreateCiclo;
  const writeRepo = mock<CicloWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCiclo,
        { provide: CicloWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<CreateCiclo>(CreateCiclo);
  });

  it("deve criar ciclo com status padrão 'planejamento' se não informado", async () => {
    const created = new CicloBuilder().withStatus('planejamento').build();
    writeRepo.create.mockResolvedValue(created);

    const input = {
      numero: 2,
      ano: 2025,
      dataInicio: new Date('2025-03-01'),
      dataFimPrevista: new Date('2025-04-30'),
    } as CreateCicloBody;

    const result = await useCase.execute(input);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'planejamento',
      }),
    );
    expect(result.ciclo).toBe(created);
  });

  it('deve usar clienteId do tenantId do request', async () => {
    writeRepo.create.mockImplementation(async (c) => c);

    await useCase.execute({
      numero: 1,
      ano: 2024,
      dataInicio: new Date('2024-01-01'),
      dataFimPrevista: new Date('2024-02-29'),
    } as CreateCicloBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });

  it('deve usar createdBy do user.id do request', async () => {
    writeRepo.create.mockImplementation(async (c) => c);

    await useCase.execute({
      numero: 1,
      ano: 2024,
      dataInicio: new Date('2024-01-01'),
      dataFimPrevista: new Date('2024-02-29'),
    } as CreateCicloBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'test-user-id',
      }),
    );
  });
});
