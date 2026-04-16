import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FilterUsuarioInput } from '../../dtos/filter-usuario.input';
import { UsuarioReadRepository } from '../../repositories/usuario-read.repository';

import { FilterUsuario } from '../filter-usuario';
import { UsuarioBuilder } from './builders/usuario.builder';

describe('FilterUsuario', () => {
  let useCase: FilterUsuario;
  const readRepo = mock<UsuarioReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilterUsuario, { provide: UsuarioReadRepository, useValue: readRepo }],
    }).compile();
    useCase = module.get<FilterUsuario>(FilterUsuario);
  });

  it('deve delegar ao repository.findAll e retornar { usuarios }', async () => {
    const lista = [new UsuarioBuilder().build(), new UsuarioBuilder().withId('u2').build()];
    readRepo.findAll.mockResolvedValue(lista);

    const filters = { clienteId: '11111111-1111-4111-8111-111111111111' } as FilterUsuarioInput;
    const result = await useCase.execute(filters);

    expect(readRepo.findAll).toHaveBeenCalledWith(filters);
    expect(result).toEqual({ usuarios: lista });
  });
});
