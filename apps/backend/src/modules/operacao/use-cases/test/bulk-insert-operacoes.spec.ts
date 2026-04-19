import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { BulkInsertOperacoesInput } from '../../dtos/bulk-insert-operacoes.body';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { BulkInsertOperacoes } from '../bulk-insert-operacoes';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('BulkInsertOperacoes', () => {
  let useCase: BulkInsertOperacoes;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  const itemId1 = 'a0000000-0000-4000-8000-000000000001';
  const itemId2 = 'b0000000-0000-4000-8000-000000000002';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkInsertOperacoes,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<BulkInsertOperacoes>(BulkInsertOperacoes);
  });

  it('deve criar operações para itens sem duplicata', async () => {
    readRepo.findAtivaParaItem.mockResolvedValue(null);
    const op1 = new OperacaoBuilder().withItemLevantamentoId(itemId1).build();
    const op2 = new OperacaoBuilder().withItemLevantamentoId(itemId2).build();
    writeRepo.create.mockResolvedValueOnce(op1).mockResolvedValueOnce(op2);

    const data: BulkInsertOperacoesInput = {
      operacoes: [
        { itemLevantamentoId: itemId1, status: 'pendente', tipoVinculo: 'levantamento' },
        { itemLevantamentoId: itemId2, status: 'pendente', tipoVinculo: 'levantamento' },
      ],
    };
    const result = await useCase.execute(data);

    expect(result.operacoes).toHaveLength(2);
    expect(result.skipped).toBe(0);
  });

  it('deve pular item quando já existe operação ativa', async () => {
    const existente = new OperacaoBuilder().withItemLevantamentoId(itemId1).build();
    readRepo.findAtivaParaItem.mockResolvedValueOnce(existente).mockResolvedValueOnce(null);
    const op2 = new OperacaoBuilder().withItemLevantamentoId(itemId2).build();
    writeRepo.create.mockResolvedValue(op2);

    const data: BulkInsertOperacoesInput = {
      operacoes: [
        { itemLevantamentoId: itemId1, status: 'pendente', tipoVinculo: 'levantamento' },
        { itemLevantamentoId: itemId2, status: 'pendente', tipoVinculo: 'levantamento' },
      ],
    };
    const result = await useCase.execute(data);

    expect(result.operacoes).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });
});
