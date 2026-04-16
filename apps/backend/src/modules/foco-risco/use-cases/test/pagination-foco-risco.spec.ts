import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoPaginated } from '../../entities/foco-risco';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { PaginationFocoRisco } from '../pagination-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('PaginationFocoRisco', () => {
  let useCase: PaginationFocoRisco;
  const readRepo = mock<FocoRiscoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaginationFocoRisco,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<PaginationFocoRisco>(PaginationFocoRisco);
  });

  it('deve retornar focos paginados', async () => {
    const focos = [new FocoRiscoBuilder().build()];
    const paginated = { items: focos, total: 1, page: 1, perPage: 10 } as any;
    readRepo.findPaginated.mockResolvedValue(paginated);

    const pagination = { currentPage: 1, perPage: 10, orderKey: 'created_at', orderValue: 'desc' } as PaginationProps;
    const result = await useCase.execute({}, pagination);

    expect(result).toBe(paginated);
    expect(readRepo.findPaginated).toHaveBeenCalledWith({}, expect.objectContaining({ currentPage: 1, perPage: 10 }));
  });
});
