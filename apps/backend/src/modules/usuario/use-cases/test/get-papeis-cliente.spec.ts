import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { UsuarioReadRepository } from '../../repositories/usuario-read.repository';

import { GetPapeisCliente } from '../get-papeis-cliente';

describe('GetPapeisCliente', () => {
  let useCase: GetPapeisCliente;
  const readRepo = mock<UsuarioReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GetPapeisCliente, { provide: UsuarioReadRepository, useValue: readRepo }],
    }).compile();
    useCase = module.get<GetPapeisCliente>(GetPapeisCliente);
  });

  it('deve retornar papéis de um cliente via readRepository.findPapeisCliente', async () => {
    const papeis = [
      { usuario_id: 'u1', papel: 'agente' },
      { usuario_id: 'u2', papel: 'supervisor' },
    ];
    readRepo.findPapeisCliente.mockResolvedValue(papeis);

    const result = await useCase.execute('cliente-uuid');

    expect(readRepo.findPapeisCliente).toHaveBeenCalledWith('cliente-uuid');
    expect(result).toEqual({ papeis });
  });
});
