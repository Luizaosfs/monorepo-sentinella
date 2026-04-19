import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mockRequest } from '@test/utils/user-helpers';
import { mock } from 'jest-mock-extended';

import { OperacaoPaginated } from '../../entities/operacao';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { PaginationOperacao } from '../pagination-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('PaginationOperacao', () => {
  let useCase: PaginationOperacao;
  const readRepo = mock<OperacaoReadRepository>();

  const pagination = {
    currentPage: 1,
    perPage: 15,
    orderKey: 'created_at',
    orderValue: 'desc' as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaginationOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        {
          provide: REQUEST,
          useValue: mockRequest({ tenantId: 'tenant-uuid-2' }),
        },
      ],
    }).compile();

    useCase = module.get<PaginationOperacao>(PaginationOperacao);
  });

  it('deve repassar filtros com clienteId do tenant para findPaginated', async () => {
    const op = new OperacaoBuilder()
      .withId('op-1')
      .withClienteId('tenant-uuid-2')
      .build();
    const paginated = {
      items: [op],
      pagination: { perPage: 15, currentPage: 1, count: 1, pagesCount: 1 },
    } as OperacaoPaginated;
    readRepo.findPaginated.mockResolvedValue(paginated);

    const result = await useCase.execute({ prioridade: 'P1' }, pagination);

    expect(result.items).toHaveLength(1);
    expect(readRepo.findPaginated).toHaveBeenCalledWith(
      { prioridade: 'P1', clienteId: 'tenant-uuid-2' },
      pagination,
    );
  });

  it('deve ignorar clienteId vindo do filtro em favor do tenant', async () => {
    readRepo.findPaginated.mockResolvedValue({
      items: [],
      pagination: { perPage: 15, currentPage: 1, count: 0, pagesCount: 0 },
    } as OperacaoPaginated);

    await useCase.execute(
      { clienteId: '00000000-0000-4000-8000-00000000dead' },
      pagination,
    );

    expect(readRepo.findPaginated).toHaveBeenCalledWith(
      { clienteId: 'tenant-uuid-2' },
      pagination,
    );
  });
});
