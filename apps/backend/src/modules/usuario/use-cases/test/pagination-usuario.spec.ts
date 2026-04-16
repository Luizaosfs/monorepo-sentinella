import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { PaginationProps } from '@shared/dtos/pagination-body';
import { FilterUsuarioInput } from '../../dtos/filter-usuario.input';
import { UsuarioPaginated } from '../../entities/usuario';
import { UsuarioReadRepository } from '../../repositories/usuario-read.repository';

import { PaginationUsuario } from '../pagination-usuario';

describe('PaginationUsuario', () => {
  let useCase: PaginationUsuario;
  const readRepo = mock<UsuarioReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaginationUsuario, { provide: UsuarioReadRepository, useValue: readRepo }],
    }).compile();
    useCase = module.get<PaginationUsuario>(PaginationUsuario);
  });

  it('deve delegar ao repository.findPaginated', async () => {
    const paginated = { items: [], total: 0 } as unknown as UsuarioPaginated;
    readRepo.findPaginated.mockResolvedValue(paginated);

    const filters = {} as FilterUsuarioInput;
    const pagination = {
      currentPage: 1,
      perPage: 15,
      orderKey: 'created_at',
      orderValue: 'desc',
    } as PaginationProps;

    const result = await useCase.execute(filters, pagination);

    expect(readRepo.findPaginated).toHaveBeenCalledWith(filters, pagination);
    expect(result).toBe(paginated);
  });
});
