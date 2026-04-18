import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { mockDeep } from 'jest-mock-extended';
import type { AuthenticatedUser } from 'src/guards/auth.guard';
import { AuthException } from 'src/guards/errors/auth.exception';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { ChangePasswordUseCase } from '../change-password.use-case';

jest.mock('bcryptjs');

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;
  const prisma = mockDeep<PrismaService>();

  const user: AuthenticatedUser = {
    id: 'usuario-id-1',
    authId: 'auth-id-1',
    email: 'user@test.com',
    nome: 'Test User',
    clienteId: 'cliente-id-1',
    agrupamentoId: null,
    papeis: ['supervisor'],
    isPlatformAdmin: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangePasswordUseCase,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    useCase = module.get<ChangePasswordUseCase>(ChangePasswordUseCase);
  });

  it('deve atualizar senha_hash no happy path com senha atual correta', async () => {
    prisma.client.usuarios.findUnique.mockResolvedValue({
      senha_hash: 'hash-atual',
    } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('novo-hash');
    prisma.client.usuarios.update.mockResolvedValue({} as any);

    const result = await useCase.execute(user, {
      currentPassword: 'senha-atual',
      newPassword: 'senha-nova-segura',
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.client.usuarios.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auth_id: 'auth-id-1' },
        data: expect.objectContaining({ senha_hash: 'novo-hash' }),
      }),
    );
  });

  it('deve lançar invalidCredentials quando usuário não encontrado', async () => {
    prisma.client.usuarios.findUnique.mockResolvedValue(null);

    await expectHttpException(
      () =>
        useCase.execute(user, {
          currentPassword: 'senha-atual',
          newPassword: 'senha-nova-segura',
        }),
      AuthException.invalidCredentials(),
    );
  });

  it('deve lançar invalidCredentials quando usuário sem senha_hash', async () => {
    prisma.client.usuarios.findUnique.mockResolvedValue({
      senha_hash: null,
    } as any);

    await expectHttpException(
      () =>
        useCase.execute(user, {
          currentPassword: 'senha-atual',
          newPassword: 'senha-nova-segura',
        }),
      AuthException.invalidCredentials(),
    );
  });

  it('deve lançar invalidCredentials quando senha atual errada', async () => {
    prisma.client.usuarios.findUnique.mockResolvedValue({
      senha_hash: 'hash-atual',
    } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expectHttpException(
      () =>
        useCase.execute(user, {
          currentPassword: 'errada',
          newPassword: 'senha-nova-segura',
        }),
      AuthException.invalidCredentials(),
    );
  });

  it('deve chamar bcrypt.hash com rounds=10', async () => {
    prisma.client.usuarios.findUnique.mockResolvedValue({
      senha_hash: 'hash-atual',
    } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('novo-hash');
    prisma.client.usuarios.update.mockResolvedValue({} as any);

    await useCase.execute(user, {
      currentPassword: 'senha-atual',
      newPassword: 'senha-nova-segura',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('senha-nova-segura', 10);
  });
});
