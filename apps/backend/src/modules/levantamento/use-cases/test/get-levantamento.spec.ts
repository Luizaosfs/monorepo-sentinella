import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { LevantamentoException } from '../../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { GetLevantamento } from '../get-levantamento';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('GetLevantamento', () => {
  let useCase: GetLevantamento;
  const readRepo = mock<LevantamentoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetLevantamento,
        { provide: LevantamentoReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest() },
      ],
    }).compile();

    useCase = module.get<GetLevantamento>(GetLevantamento);
  });

  it('deve retornar levantamento com itens (via findByIdComItens)', async () => {
    const lev = new LevantamentoBuilder().withId('lev-1').build();
    readRepo.findByIdComItens.mockResolvedValue(lev);

    const result = await useCase.execute('lev-1');

    expect(result.levantamento).toBe(lev);
    expect(readRepo.findByIdComItens).toHaveBeenCalledWith('lev-1', 'test-cliente-id');
  });

  it('deve rejeitar não encontrado', async () => {
    readRepo.findByIdComItens.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe'),
      LevantamentoException.notFound(),
    );
  });
});
