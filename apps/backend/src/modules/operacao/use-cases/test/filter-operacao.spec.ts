import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mockRequest } from '@test/utils/user-helpers';
import { mock } from 'jest-mock-extended';

import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { FilterOperacao } from '../filter-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('FilterOperacao', () => {
  let useCase: FilterOperacao;
  const readRepo = mock<OperacaoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        {
          provide: REQUEST,
          useValue: mockRequest({ tenantId: 'tenant-uuid-1' }),
        },
      ],
    }).compile();

    useCase = module.get<FilterOperacao>(FilterOperacao);
  });

  it('deve retornar operações com clienteId sempre do tenant (MT-02)', async () => {
    const op = new OperacaoBuilder()
      .withId('op-1')
      .withClienteId('tenant-uuid-1')
      .build();
    readRepo.findAll.mockResolvedValue([op]);

    const result = await useCase.execute({ status: 'pendente' });

    expect(result.operacoes).toHaveLength(1);
    expect(readRepo.findAll).toHaveBeenCalledWith({
      status: 'pendente',
      clienteId: 'tenant-uuid-1',
    });
  });

  it('deve sobrescrever clienteId do filtro com o tenantId do request', async () => {
    readRepo.findAll.mockResolvedValue([]);

    await useCase.execute({
      clienteId: '00000000-0000-4000-8000-00000000dead',
      focoRiscoId: 'b0000000-0000-4000-8000-000000000002',
    });

    expect(readRepo.findAll).toHaveBeenCalledWith({
      clienteId: 'tenant-uuid-1',
      focoRiscoId: 'b0000000-0000-4000-8000-000000000002',
    });
  });

  it('deve retornar lista vazia quando não há operações', async () => {
    readRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute({});

    expect(result.operacoes).toEqual([]);
  });
});
