import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';
import { AuthException } from 'src/guards/errors/auth.exception';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { RefreshTokenUseCase } from '../refresh-token.use-case';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  const prisma = mockDeep<PrismaService>();
  const jwtService = mockDeep<JwtService>();

  const usuarioBase = {
    id: 'usuario-id-1',
    auth_id: 'auth-id-1',
    email: 'user@test.com',
    nome: 'Test User',
    cliente_id: 'cliente-id-1',
    agrupamento_id: null,
    ativo: true,
    papeis_usuarios: [{ papel: 'supervisor' }],
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    useCase = module.get<RefreshTokenUseCase>(RefreshTokenUseCase);
  });

  it('deve emitir novos access+refresh no happy path', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'auth-id-1',
      type: 'refresh',
    });
    prisma.client.usuarios.findUnique.mockResolvedValue(usuarioBase);
    jwtService.signAsync
      .mockResolvedValueOnce('novo-access')
      .mockResolvedValueOnce('novo-refresh');

    const result = await useCase.execute({ refreshToken: 'token-valido' });

    expect(result).toEqual({
      accessToken: 'novo-access',
      refreshToken: 'novo-refresh',
      user: {
        id: 'usuario-id-1',
        authId: 'auth-id-1',
        email: 'user@test.com',
        nome: 'Test User',
        clienteId: 'cliente-id-1',
        agrupamentoId: null,
        papeis: ['supervisor'],
        isPlatformAdmin: false,
      },
    });
  });

  it('deve lançar unauthorized quando refresh expirado (verifyAsync throws)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expectHttpException(
      () => useCase.execute({ refreshToken: 'token-expirado' }),
      AuthException.unauthorized(),
    );
  });

  it('deve lançar unauthorized quando secret errado (verifyAsync throws)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    await expectHttpException(
      () => useCase.execute({ refreshToken: 'token-com-secret-errado' }),
      AuthException.unauthorized(),
    );
  });

  it('deve lançar unauthorized quando payload.type !== refresh', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'auth-id-1',
      type: 'access',
    });

    await expectHttpException(
      () => useCase.execute({ refreshToken: 'access-token-como-refresh' }),
      AuthException.unauthorized(),
    );
  });
});
