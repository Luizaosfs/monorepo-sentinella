import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CreateOperacaoBody } from '../../dtos/create-operacao.body';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateOperacao } from '../create-operacao';

describe('CreateOperacao', () => {
  let useCase: CreateOperacao;
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateOperacao,
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<CreateOperacao>(CreateOperacao);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("deve criar operação com status padrão 'pendente'", async () => {
    writeRepo.create.mockImplementation(async (o) => o);

    await useCase.execute({} as CreateOperacaoBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pendente', clienteId: 'test-cliente-id' }),
    );
  });

  it('deve usar clienteId do tenant quando não informado', async () => {
    writeRepo.create.mockImplementation(async (o) => o);

    await useCase.execute({} as CreateOperacaoBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });

  it("deve preencher iniciadoEm quando status='em_andamento'", async () => {
    const agora = new Date('2026-04-01T12:00:00Z');
    jest.setSystemTime(agora);
    writeRepo.create.mockImplementation(async (o) => o);

    await useCase.execute({ status: 'em_andamento' } as CreateOperacaoBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'em_andamento',
        iniciadoEm: agora,
      }),
    );
  });
});
