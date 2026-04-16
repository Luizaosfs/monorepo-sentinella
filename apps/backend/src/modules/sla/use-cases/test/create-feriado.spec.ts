import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateFeriadoBody } from '../../dtos/create-feriado.body';
import { CreateFeriado } from '../create-feriado';
import { SlaFeriadoBuilder } from './builders/sla-config.builder';

describe('CreateFeriado', () => {
  let useCase: CreateFeriado;
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateFeriado,
        { provide: SlaWriteRepository, useValue: writeRepo },
        {
          provide: REQUEST,
          useValue: mockRequest({ tenantId: 'test-cliente-id' }),
        },
      ],
    }).compile();
    useCase = module.get<CreateFeriado>(CreateFeriado);
  });

  it('deve criar feriado com clienteId do tenant', async () => {
    const feriado = new SlaFeriadoBuilder().build();
    writeRepo.createFeriado.mockResolvedValue(feriado);

    const data = new Date('2025-12-25');
    const result = await useCase.execute({
      data,
      descricao: 'Natal',
      nacional: true,
    });

    expect(writeRepo.createFeriado).toHaveBeenCalledWith({
      clienteId: 'test-cliente-id',
      data,
      descricao: 'Natal',
      nacional: true,
    });
    expect(result.feriado).toBe(feriado);
  });

  it('deve usar nacional=false como padrão se não informado', async () => {
    const feriado = new SlaFeriadoBuilder().withNacional(false).build();
    writeRepo.createFeriado.mockResolvedValue(feriado);

    await useCase.execute({
      data: new Date('2025-01-01'),
      descricao: 'Municipal',
    } as CreateFeriadoBody);

    expect(writeRepo.createFeriado).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'test-cliente-id',
        nacional: false,
      }),
    );
  });
});
