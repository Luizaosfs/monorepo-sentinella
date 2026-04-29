import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaOperacionalPaginated } from '../../entities/sla-operacional';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { PaginationSla } from '../pagination-sla';

describe('PaginationSla', () => {
  let useCase: PaginationSla;
  const readRepo = mock<SlaReadRepository>();

  const pagination = {
    currentPage: 1,
    perPage: 15,
    orderKey: 'created_at',
    orderValue: 'desc' as const,
  };

  const emptyPaginated = {
    items: [],
    pagination: { perPage: 15, currentPage: 1, count: 0, pagesCount: 0 },
  } as unknown as SlaOperacionalPaginated;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaginationSla,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'tenant-sla-2' }) },
      ],
    }).compile();
    useCase = module.get<PaginationSla>(PaginationSla);
  });

  it('deve repassar filtros com clienteId do tenant', async () => {
    readRepo.findPaginated.mockResolvedValue(emptyPaginated);

    await useCase.execute({ status: 'pendente' }, pagination);

    expect(readRepo.findPaginated).toHaveBeenCalledWith(
      { status: 'pendente', clienteId: 'tenant-sla-2' },
      pagination,
    );
  });

  it('deve ignorar clienteId do filtro em favor do tenant', async () => {
    readRepo.findPaginated.mockResolvedValue(emptyPaginated);

    await useCase.execute({ clienteId: 'outro-cliente-id' }, pagination);

    expect(readRepo.findPaginated).toHaveBeenCalledWith(
      { clienteId: 'tenant-sla-2' },
      pagination,
    );
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: PaginationSla;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaginationSla,
          { provide: SlaReadRepository, useValue: readRepo },
          {
            provide: REQUEST,
            useValue: mockRequest({
              accessScope: {
                kind: 'platform' as const,
                userId: 'admin-id',
                papeis: ['admin'] as any,
                isAdmin: true,
                tenantId: null,
                clienteIdsPermitidos: null,
                agrupamentoId: null,
              },
            }),
          },
        ],
      }).compile();
      ucAdmin = module.get<PaginationSla>(PaginationSla);
    });

    it('deve chamar findPaginated sem clienteId quando admin sem tenant', async () => {
      readRepo.findPaginated.mockResolvedValue(emptyPaginated);

      await ucAdmin.execute({ status: 'em_andamento' }, pagination);

      expect(readRepo.findPaginated).toHaveBeenCalledWith(
        { status: 'em_andamento', clienteId: undefined },
        pagination,
      );
    });
  });
});
