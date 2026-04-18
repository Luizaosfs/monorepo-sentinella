import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { MeUseCase } from '../me.use-case';

describe('MeUseCase', () => {
  let useCase: MeUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeUseCase],
    }).compile();

    useCase = module.get<MeUseCase>(MeUseCase);
  });

  it('deve retornar projeção correta do user autenticado', () => {
    const user: AuthenticatedUser = {
      id: 'usuario-id-1',
      authId: 'auth-id-1',
      email: 'user@test.com',
      nome: 'Test User',
      clienteId: 'cliente-id-1',
      agrupamentoId: 'agrup-id-1',
      papeis: ['supervisor'],
      isPlatformAdmin: false,
    };

    const result = useCase.execute(user);

    expect(result).toEqual({
      id: 'usuario-id-1',
      authId: 'auth-id-1',
      email: 'user@test.com',
      nome: 'Test User',
      clienteId: 'cliente-id-1',
      agrupamentoId: 'agrup-id-1',
      papeis: ['supervisor'],
      isPlatformAdmin: false,
    });
  });

  it('deve incluir papéis e clienteId na projeção', () => {
    const user: AuthenticatedUser = {
      id: 'usuario-id-2',
      authId: 'auth-id-2',
      email: 'admin@test.com',
      nome: 'Admin User',
      clienteId: null,
      agrupamentoId: null,
      papeis: ['admin'],
      isPlatformAdmin: true,
    };

    const result = useCase.execute(user);

    expect(result.papeis).toEqual(['admin']);
    expect(result.clienteId).toBeNull();
    expect(result.isPlatformAdmin).toBe(true);
  });
});
