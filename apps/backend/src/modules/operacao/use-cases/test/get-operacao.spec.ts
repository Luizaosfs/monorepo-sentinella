import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { GetOperacao } from '../get-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('GetOperacao', () => {
  let useCase: GetOperacao;
  const readRepo = mock<OperacaoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest() },
      ],
    }).compile();
    useCase = module.get<GetOperacao>(GetOperacao);
  });

  it('deve retornar operação com evidências (via findByIdComEvidencias)', async () => {
    const op = new OperacaoBuilder().withId('op-1').build();
    readRepo.findByIdComEvidencias.mockResolvedValue(op);

    const result = await useCase.execute('op-1');

    expect(readRepo.findByIdComEvidencias).toHaveBeenCalledWith('op-1');
    expect(result.operacao).toBe(op);
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findByIdComEvidencias.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('nao-existe'), OperacaoException.notFound());
  });
});
