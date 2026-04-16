import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CriarParaItemBody } from '../../dtos/criar-para-item.body';
import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { CriarParaItem } from '../criar-para-item';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('CriarParaItem', () => {
  let useCase: CriarParaItem;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  const itemId = 'b2222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriarParaItem,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<CriarParaItem>(CriarParaItem);
  });

  it("deve criar operação para item de levantamento com status='pendente' e tipoVinculo='levantamento'", async () => {
    readRepo.findAtivaParaItem.mockResolvedValue(null);
    const created = new OperacaoBuilder().withItemLevantamentoId(itemId).build();
    writeRepo.create.mockResolvedValue(created);

    const data = { itemLevantamentoId: itemId } as CriarParaItemBody;
    const result = await useCase.execute(data);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'test-cliente-id',
        status: 'pendente',
        tipoVinculo: 'levantamento',
        itemLevantamentoId: itemId,
      }),
    );
    expect(result.operacao).toBe(created);
  });

  it('deve rejeitar se já existe operação ativa para o item', async () => {
    readRepo.findAtivaParaItem.mockResolvedValue(new OperacaoBuilder().build());

    await expectHttpException(
      () => useCase.execute({ itemLevantamentoId: itemId } as CriarParaItemBody),
      OperacaoException.alreadyExists(),
    );
    expect(writeRepo.create).not.toHaveBeenCalled();
  });
});
