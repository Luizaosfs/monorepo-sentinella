import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { ResolverOperacao } from '../resolver-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('ResolverOperacao', () => {
  let useCase: ResolverOperacao;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolverOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest() },
      ],
    }).compile();
    useCase = module.get<ResolverOperacao>(ResolverOperacao);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("deve mudar status para 'concluido' e preencher concluidoEm", async () => {
    const agora = new Date('2026-05-10T10:00:00Z');
    jest.setSystemTime(agora);

    const op = new OperacaoBuilder().withId('op-1').withStatus('em_andamento').build();
    readRepo.findById.mockResolvedValue(op);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute('op-1');

    expect(result.operacao.status).toBe('concluido');
    expect(result.operacao.concluidoEm?.getTime()).toBe(agora.getTime());
    expect(writeRepo.save).toHaveBeenCalledWith(op);
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('x'), OperacaoException.notFound());
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
