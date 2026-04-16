import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { PlanoAcaoException } from '../../errors/plano-acao.exception';
import { PlanoAcaoReadRepository } from '../../repositories/plano-acao-read.repository';
import { PlanoAcaoWriteRepository } from '../../repositories/plano-acao-write.repository';
import { DeletePlanoAcao } from '../delete-plano-acao';
import { PlanoAcaoBuilder } from './builders/plano-acao.builder';

describe('DeletePlanoAcao', () => {
  let useCase: DeletePlanoAcao;
  const readRepo = mock<PlanoAcaoReadRepository>();
  const writeRepo = mock<PlanoAcaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletePlanoAcao,
        { provide: PlanoAcaoReadRepository, useValue: readRepo },
        { provide: PlanoAcaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<DeletePlanoAcao>(DeletePlanoAcao);
  });

  it('deve deletar plano existente', async () => {
    const plano = new PlanoAcaoBuilder().build();
    readRepo.findById.mockResolvedValue(plano);
    writeRepo.delete.mockResolvedValue();

    const result = await useCase.execute(plano.id!);

    expect(result.deleted).toBe(true);
    expect(writeRepo.delete).toHaveBeenCalledWith(plano.id, 'test-cliente-id');
  });

  it('deve rejeitar não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-id'), PlanoAcaoException.notFound());
    expect(writeRepo.delete).not.toHaveBeenCalled();
  });

  it('deve rejeitar tenantId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletePlanoAcao,
        { provide: PlanoAcaoReadRepository, useValue: readRepo },
        { provide: PlanoAcaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = module.get<DeletePlanoAcao>(DeletePlanoAcao);

    await expectHttpException(() => uc.execute('any-id'), PlanoAcaoException.tenantRequired());
    expect(readRepo.findById).not.toHaveBeenCalled();
  });
});
