import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { mockDeep } from 'jest-mock-extended';
import { AuthException } from 'src/guards/errors/auth.exception';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { ResetPasswordUseCase } from '../reset-password.use-case';

jest.mock('bcryptjs');

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;
  const prisma = mockDeep<PrismaService>();

  const tokenPlain = 'token-plain-teste';
  const tokenHash = crypto.createHash('sha256').update(tokenPlain).digest('hex');

  const recordValido = {
    id: 'reset-id-1',
    auth_id: 'auth-id-1',
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    used_at: null,
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordUseCase,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    useCase = module.get<ResetPasswordUseCase>(ResetPasswordUseCase);
  });

  it('deve atualizar senha no happy path com token válido', async () => {
    prisma.client.password_reset_tokens.findUnique.mockResolvedValue(
      recordValido,
    );
    (bcrypt.hash as jest.Mock).mockResolvedValue('novo-hash');
    prisma.client.usuarios.update.mockResolvedValue({} as any);
    prisma.client.password_reset_tokens.update.mockResolvedValue({} as any);

    const result = await useCase.execute({
      token: tokenPlain,
      newPassword: 'senha-nova-forte',
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.client.usuarios.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auth_id: 'auth-id-1' },
        data: expect.objectContaining({ senha_hash: 'novo-hash' }),
      }),
    );
  });

  it('deve lançar unauthorized quando token não existe', async () => {
    prisma.client.password_reset_tokens.findUnique.mockResolvedValue(null);

    await expectHttpException(
      () =>
        useCase.execute({
          token: 'token-inexistente',
          newPassword: 'qualquer-senha',
        }),
      AuthException.unauthorized(),
    );
  });

  it('deve lançar unauthorized quando token já foi usado', async () => {
    prisma.client.password_reset_tokens.findUnique.mockResolvedValue({
      ...recordValido,
      used_at: new Date(),
    });

    await expectHttpException(
      () =>
        useCase.execute({ token: tokenPlain, newPassword: 'qualquer-senha' }),
      AuthException.unauthorized(),
    );
  });

  it('deve lançar unauthorized quando token expirado', async () => {
    prisma.client.password_reset_tokens.findUnique.mockResolvedValue({
      ...recordValido,
      expires_at: new Date(Date.now() - 60 * 60 * 1000),
    });

    await expectHttpException(
      () =>
        useCase.execute({ token: tokenPlain, newPassword: 'qualquer-senha' }),
      AuthException.unauthorized(),
    );
  });

  it('deve lançar unauthorized quando update falha com P2025 (usuário não encontrado)', async () => {
    prisma.client.password_reset_tokens.findUnique.mockResolvedValue(recordValido);
    (bcrypt.hash as jest.Mock).mockResolvedValue('novo-hash');
    const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
    prisma.client.usuarios.update.mockRejectedValue(p2025);

    await expectHttpException(
      () => useCase.execute({ token: tokenPlain, newPassword: 'senha-nova-forte' }),
      AuthException.unauthorized(),
    );
  });

  it('deve popular used_at após uso do token', async () => {
    prisma.client.password_reset_tokens.findUnique.mockResolvedValue(
      recordValido,
    );
    (bcrypt.hash as jest.Mock).mockResolvedValue('novo-hash');
    prisma.client.usuarios.update.mockResolvedValue({} as any);
    prisma.client.password_reset_tokens.update.mockResolvedValue({} as any);

    await useCase.execute({ token: tokenPlain, newPassword: 'senha-nova-forte' });

    expect(prisma.client.password_reset_tokens.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reset-id-1' },
        data: expect.objectContaining({ used_at: expect.any(Date) }),
      }),
    );
  });
});
