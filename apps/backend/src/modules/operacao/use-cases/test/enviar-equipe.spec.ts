import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CreateOperacaoBody } from '../../dtos/create-operacao.body';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { EnviarEquipe } from '../enviar-equipe';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('EnviarEquipe', () => {
  let useCase: EnviarEquipe;
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnviarEquipe,
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<EnviarEquipe>(EnviarEquipe);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("deve criar operação com status='em_andamento' e iniciadoEm preenchido", async () => {
    const agora = new Date('2026-06-01T14:30:00Z');
    jest.setSystemTime(agora);
    const created = new OperacaoBuilder().withStatus('em_andamento').withIniciadoEm(agora).build();
    writeRepo.create.mockResolvedValue(created);

    const result = await useCase.execute({} as CreateOperacaoBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'em_andamento',
        iniciadoEm: agora,
      }),
    );
    expect(result.operacao).toBe(created);
  });

  it('deve usar clienteId do tenant como fallback', async () => {
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    writeRepo.create.mockImplementation(async (o) => o);

    await useCase.execute({} as CreateOperacaoBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });
});
