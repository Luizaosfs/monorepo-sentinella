import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ConcluirParaItemInput } from '../../dtos/concluir-para-item-operacao.body';
import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { ConcluirParaItemOperacao } from '../concluir-para-item-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('ConcluirParaItemOperacao', () => {
  let useCase: ConcluirParaItemOperacao;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  const itemId = 'a0000000-0000-4000-8000-000000000001';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcluirParaItemOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<ConcluirParaItemOperacao>(ConcluirParaItemOperacao);
  });

  it('deve concluir operação ativa e setar concluidoEm', async () => {
    const operacao = new OperacaoBuilder().withStatus('em_andamento').withItemLevantamentoId(itemId).build();
    readRepo.findAtivaParaItem.mockResolvedValue(operacao);
    writeRepo.save.mockResolvedValue();

    const data: ConcluirParaItemInput = { itemLevantamentoId: itemId };
    const result = await useCase.execute(data);

    expect(result.operacao.status).toBe('concluido');
    expect(result.operacao.concluidoEm).toBeInstanceOf(Date);
    expect(writeRepo.save).toHaveBeenCalled();
  });

  it('deve lançar notFound quando não existe operação ativa para o item', async () => {
    readRepo.findAtivaParaItem.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute({ itemLevantamentoId: itemId }),
      OperacaoException.notFound(),
    );
  });
});
