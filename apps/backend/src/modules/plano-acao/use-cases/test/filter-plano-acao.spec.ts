import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';

import { PlanoAcaoReadRepository } from '../../repositories/plano-acao-read.repository';
import { FilterPlanoAcao } from '../filter-plano-acao';
import { PlanoAcaoBuilder } from './builders/plano-acao.builder';

describe('FilterPlanoAcao', () => {
  let useCase: FilterPlanoAcao;
  const readRepo = mock<PlanoAcaoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterPlanoAcao,
        { provide: PlanoAcaoReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<FilterPlanoAcao>(FilterPlanoAcao);
  });

  it('deve usar clienteId do filtro ou fallback tenant e delegar ao findAllActive', async () => {
    const list = [new PlanoAcaoBuilder().build()];
    readRepo.findAllActive.mockResolvedValue(list);

    const explicit = await useCase.execute({
      clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(readRepo.findAllActive).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
    expect(explicit.planosAcao).toEqual(list);

    readRepo.findAllActive.mockResolvedValue(list);
    const fallback = await useCase.execute({});
    expect(readRepo.findAllActive).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
    expect(fallback.planosAcao).toEqual(list);
  });
});
