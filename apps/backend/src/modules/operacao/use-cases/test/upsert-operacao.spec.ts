import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { UpsertOperacaoInput } from '../../dtos/upsert-operacao.body';
import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { UpsertOperacao } from '../upsert-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('UpsertOperacao', () => {
  let useCase: UpsertOperacao;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<UpsertOperacao>(UpsertOperacao);
  });

  it('deve criar nova operação quando id não é fornecido', async () => {
    const created = new OperacaoBuilder().withStatus('pendente').build();
    writeRepo.create.mockResolvedValue(created);

    const data = { status: 'pendente' } as UpsertOperacaoInput;
    const result = await useCase.execute(data);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id', status: 'pendente' }),
    );
    expect(result.operacao).toBe(created);
  });

  it('deve atualizar operação existente e setar iniciadoEm ao transitar para em_andamento', async () => {
    const existente = new OperacaoBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(existente);
    writeRepo.save.mockResolvedValue();

    const data = { id: existente.id, status: 'em_andamento' } as UpsertOperacaoInput;
    const result = await useCase.execute(data);

    expect(result.operacao.status).toBe('em_andamento');
    expect(result.operacao.iniciadoEm).toBeInstanceOf(Date);
    expect(writeRepo.save).toHaveBeenCalled();
  });

  it('deve lançar notFound quando id fornecido mas operação não existe', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute({ id: 'non-existent-uuid', status: 'concluido' } as UpsertOperacaoInput),
      OperacaoException.notFound(),
    );
  });
});
