import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { PlanoAcaoException } from '../../errors/plano-acao.exception';
import { PlanoAcaoReadRepository } from '../../repositories/plano-acao-read.repository';
import { PlanoAcaoWriteRepository } from '../../repositories/plano-acao-write.repository';
import { SavePlanoAcao } from '../save-plano-acao';
import { PlanoAcaoBuilder } from './builders/plano-acao.builder';

describe('SavePlanoAcao', () => {
  let useCase: SavePlanoAcao;
  const readRepo = mock<PlanoAcaoReadRepository>();
  const writeRepo = mock<PlanoAcaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavePlanoAcao,
        { provide: PlanoAcaoReadRepository, useValue: readRepo },
        { provide: PlanoAcaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<SavePlanoAcao>(SavePlanoAcao);
  });

  it('deve atualizar campos parciais e não alterar campos não enviados', async () => {
    const plano = new PlanoAcaoBuilder()
      .withLabel('Original')
      .withDescricao('Desc fixa')
      .withTipoItem('tipo-original')
      .withAtivo(true)
      .withOrdem(5)
      .build();
    readRepo.findById.mockResolvedValue(plano);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(plano.id!, { label: 'Novo rótulo' });

    expect(plano.label).toBe('Novo rótulo');
    expect(plano.descricao).toBe('Desc fixa');
    expect(plano.tipoItem).toBe('tipo-original');
    expect(plano.ordem).toBe(5);
    expect(writeRepo.save).toHaveBeenCalledWith(plano);
  });

  it('deve rejeitar não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('missing-id', { label: 'x' }),
      PlanoAcaoException.notFound(),
    );
  });

  it('deve rejeitar tenantId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavePlanoAcao,
        { provide: PlanoAcaoReadRepository, useValue: readRepo },
        { provide: PlanoAcaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = module.get<SavePlanoAcao>(SavePlanoAcao);

    await expectHttpException(() => uc.execute('any-id', { label: 'x' }), PlanoAcaoException.tenantRequired());
    expect(readRepo.findById).not.toHaveBeenCalled();
  });
});
