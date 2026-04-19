import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { PaginationProps } from '@shared/dtos/pagination-body';

import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { PaginationVistoria } from '../pagination-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

const TENANT_FALLBACK = '44444444-4444-4444-8444-444444444444';
const EXPLICIT_CLIENTE = '55555555-5555-4555-8555-555555555555';
const OTHER_TENANT = '66666666-6666-4666-8666-666666666666';

describe('PaginationVistoria', () => {
  let useCase: PaginationVistoria;
  const readRepo = mock<VistoriaReadRepository>();

  async function createModule(
    req = mockRequest({ tenantId: TENANT_FALLBACK }),
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaginationVistoria,
        { provide: VistoriaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();
    return module.get<PaginationVistoria>(PaginationVistoria);
  }

  const pagination = {
    currentPage: 1,
    perPage: 10,
    orderKey: 'created_at',
    orderValue: 'desc',
  } as PaginationProps;

  beforeEach(async () => {
    jest.clearAllMocks();
    useCase = await createModule();
  });

  it('deve usar clienteId do tenant (MT-02) ignorando clienteId do filtro', async () => {
    useCase = await createModule(mockRequest({ tenantId: OTHER_TENANT }));
    const items = [new VistoriaBuilder().build()];
    const paginated = {
      items,
      total: 1,
      page: 1,
      perPage: 10,
    } as any;
    readRepo.findPaginated.mockResolvedValue(paginated);

    const result = await useCase.execute(
      { clienteId: EXPLICIT_CLIENTE, ciclo: 2 },
      pagination,
    );

    expect(result).toBe(paginated);
    expect(readRepo.findPaginated).toHaveBeenCalledWith(
      { clienteId: OTHER_TENANT, ciclo: 2 },
      pagination,
    );
  });

  it('deve usar tenantId do request como fallback', async () => {
    const paginated = {
      items: [],
      total: 0,
      page: 1,
      perPage: 10,
    } as any;
    readRepo.findPaginated.mockResolvedValue(paginated);

    await useCase.execute(
      { imovelId: '00000000-0000-4000-8000-000000000002' },
      pagination,
    );

    expect(readRepo.findPaginated).toHaveBeenCalledWith(
      {
        clienteId: TENANT_FALLBACK,
        imovelId: '00000000-0000-4000-8000-000000000002',
      },
      pagination,
    );
  });

  it('deve delegar ao repository.findPaginated com filters e pagination', async () => {
    const paginated = {
      items: [],
      total: 0,
      page: 2,
      perPage: 5,
    } as any;
    readRepo.findPaginated.mockResolvedValue(paginated);
    const customPagination = {
      currentPage: 2,
      perPage: 5,
      orderKey: 'data_visita',
      orderValue: 'asc',
    } as PaginationProps;

    const result = await useCase.execute({}, customPagination);

    expect(result).toBe(paginated);
    expect(readRepo.findPaginated).toHaveBeenCalledWith(
      { clienteId: TENANT_FALLBACK },
      customPagination,
    );
  });
});
