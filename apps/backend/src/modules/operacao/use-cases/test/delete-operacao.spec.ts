import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { DeleteOperacao } from '../delete-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('DeleteOperacao', () => {
  let useCase: DeleteOperacao;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  const req = () =>
    mockRequest({
      tenantId: 'test-cliente-id',
      user: { id: 'deleter-user-id', email: 'del@test.com', nome: 'Deleter', clienteId: 'test-cliente-id', papeis: ['admin'] },
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: req() },
      ],
    }).compile();
    useCase = module.get<DeleteOperacao>(DeleteOperacao);
  });

  it('deve chamar softDelete com id e userId do request', async () => {
    const op = new OperacaoBuilder().withId('del-1').build();
    readRepo.findById.mockResolvedValue(op);
    writeRepo.softDelete.mockResolvedValue();

    const result = await useCase.execute('del-1');

    expect(writeRepo.softDelete).toHaveBeenCalledWith('del-1', 'deleter-user-id');
    expect(result).toEqual({ deleted: true });
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('x'), OperacaoException.notFound());
    expect(writeRepo.softDelete).not.toHaveBeenCalled();
  });
});
