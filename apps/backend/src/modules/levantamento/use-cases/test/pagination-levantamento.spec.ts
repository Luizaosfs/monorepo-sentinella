import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { PaginationLevantamento } from '../pagination-levantamento';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('PaginationLevantamento', () => {
  let useCase: PaginationLevantamento;
  const readRepo = mock<LevantamentoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaginationLevantamento,
        { provide: LevantamentoReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<PaginationLevantamento>(PaginationLevantamento);
  });

  it('deve delegar ao repository.findPaginated com filters e pagination', async () => {
    const items = [new LevantamentoBuilder().build()];
    const paginated = { items, total: 1, page: 1, perPage: 10 } as any;
    readRepo.findPaginated.mockResolvedValue(paginated);

    const filters = { statusProcessamento: 'aguardando' };
    const pagination = {
      currentPage: 2,
      perPage: 20,
      orderKey: 'created_at',
      orderValue: 'desc' as const,
    } as PaginationProps;

    const result = await useCase.execute(filters as any, pagination);

    expect(result).toBe(paginated);
    expect(readRepo.findPaginated).toHaveBeenCalledWith(filters, pagination);
  });
});
