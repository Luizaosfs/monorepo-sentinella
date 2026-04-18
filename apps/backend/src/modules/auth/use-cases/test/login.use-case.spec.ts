import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { mockDeep } from 'jest-mock-extended';
import { AuthException } from 'src/guards/errors/auth.exception';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { LoginUseCase } from '../login.use-case';

jest.mock('bcryptjs');

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
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
    senha_hash: 'hash-existente',
    papeis_usuarios: [
      { papel: 'supervisor' },
      { papel: 'notificador' },
    ],
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    useCase = module.get<LoginUseCase>(LoginUseCase);

    jwtService.signAsync
      .mockResolvedValueOnce('access-token-fake')
      .mockResolvedValueOnce('refresh-token-fake');
  });

  it('deve retornar access+refresh+user com papéis em credenciais válidas', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue(usuarioBase);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'user@test.com',
      password: 'senha-correta',
    });

    expect(result.accessToken).toBe('access-token-fake');
    expect(result.refreshToken).toBe('refresh-token-fake');
    expect(result.user).toEqual({
      id: 'usuario-id-1',
      authId: 'auth-id-1',
      email: 'user@test.com',
      nome: 'Test User',
      clienteId: 'cliente-id-1',
      agrupamentoId: null,
      papeis: ['supervisor', 'notificador'],
      isPlatformAdmin: false,
    });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
  });

  it('deve buscar com mode insensitive quando email em MAIÚSCULAS', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue(usuarioBase);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await useCase.execute({
      email: 'USER@TEST.COM',
      password: 'senha-correta',
    });

    expect(prisma.client.usuarios.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: { equals: 'USER@TEST.COM', mode: 'insensitive' },
        },
        include: { papeis_usuarios: true },
      }),
    );
  });

  it('deve aplicar trim em emails com espaços antes de buscar', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue(usuarioBase);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await useCase.execute({
      email: '   user@test.com   ',
      password: 'senha-correta',
    });

    expect(prisma.client.usuarios.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'user@test.com', mode: 'insensitive' } },
        include: { papeis_usuarios: true },
      }),
    );
  });

  it('deve lançar invalidCredentials se usuário não existe', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute({ email: 'nao-existe@test.com', password: '123456' }),
      AuthException.invalidCredentials(),
    );
  });

  it('deve lançar inactiveUser quando ativo=false', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue({
      ...usuarioBase,
      ativo: false,
    });

    await expectHttpException(
      () => useCase.execute({ email: 'user@test.com', password: '123456' }),
      AuthException.inactiveUser(),
    );
  });

  it('deve lançar notLinked quando auth_id é null', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue({
      ...usuarioBase,
      auth_id: null,
    });

    await expectHttpException(
      () => useCase.execute({ email: 'user@test.com', password: '123456' }),
      AuthException.notLinked(),
    );
  });

  it('deve lançar invalidCredentials quando usuário sem senha_hash', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue({
      ...usuarioBase,
      senha_hash: null,
    });

    await expectHttpException(
      () => useCase.execute({ email: 'user@test.com', password: '123456' }),
      AuthException.invalidCredentials(),
    );
  });

  it('deve lançar invalidCredentials quando senha errada', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue(usuarioBase);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expectHttpException(
      () => useCase.execute({ email: 'user@test.com', password: 'senha-errada' }),
      AuthException.invalidCredentials(),
    );
  });
});
