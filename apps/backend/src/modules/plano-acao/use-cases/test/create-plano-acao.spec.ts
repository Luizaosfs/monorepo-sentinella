import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { CreatePlanoAcaoBody } from '../../dtos/create-plano-acao.body';
import { PlanoAcaoException } from '../../errors/plano-acao.exception';
import { PlanoAcaoWriteRepository } from '../../repositories/plano-acao-write.repository';
import { CreatePlanoAcao } from '../create-plano-acao';
import { PlanoAcaoBuilder } from './builders/plano-acao.builder';

describe('CreatePlanoAcao', () => {
  let useCase: CreatePlanoAcao;
  const writeRepo = mock<PlanoAcaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePlanoAcao,
        { provide: PlanoAcaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<CreatePlanoAcao>(CreatePlanoAcao);
  });

  it('deve criar plano com ativo=true e ordem=0 padrão e usar clienteId do input ou fallback tenant', async () => {
    const created = new PlanoAcaoBuilder().withClienteId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').build();
    writeRepo.create.mockResolvedValue(created);

    await useCase.execute({
      clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: 'L1',
    } as CreatePlanoAcaoBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ativo: true,
        ordem: 0,
      }),
    );

    const fallback = new PlanoAcaoBuilder().build();
    writeRepo.create.mockResolvedValue(fallback);

    await useCase.execute({ label: 'L2' } as CreatePlanoAcaoBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });

  it('deve rejeitar clienteId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePlanoAcao,
        { provide: PlanoAcaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = module.get<CreatePlanoAcao>(CreatePlanoAcao);

    await expectHttpException(
      () => uc.execute({ label: 'x' } as CreatePlanoAcaoBody),
      PlanoAcaoException.tenantRequired(),
    );
  });
});
