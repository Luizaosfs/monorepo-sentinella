import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';

import { EmailService } from '../../email.service';
import { ForgotPasswordUseCase } from '../forgot-password.use-case';

describe('ForgotPasswordUseCase', () => {
  let useCase: ForgotPasswordUseCase;
  const prisma = mockDeep<PrismaService>();
  const emailService = mockDeep<EmailService>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForgotPasswordUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    useCase = module.get<ForgotPasswordUseCase>(ForgotPasswordUseCase);
  });

  it('deve gerar token e enviar email no happy path', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue({
      auth_id: 'auth-id-1',
    } as any);
    prisma.client.password_reset_tokens.updateMany.mockResolvedValue({
      count: 0,
    } as any);
    prisma.client.password_reset_tokens.create.mockResolvedValue({} as any);
    emailService.sendPasswordReset.mockResolvedValue(undefined);

    const result = await useCase.execute({ email: 'user@test.com' });

    expect(result).toEqual({ ok: true });
    expect(prisma.client.password_reset_tokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          auth_id: 'auth-id-1',
          token_hash: expect.any(String),
          expires_at: expect.any(Date),
        }),
      }),
    );
    // Bug corrigido: email normalizado (lowercase + trim) deve ser enviado
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      'user@test.com',
      expect.stringContaining('token='),
    );
  });

  it('deve enviar email normalizado (lowercase) mesmo se input em maiúsculas', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue({
      auth_id: 'auth-id-1',
    } as any);
    prisma.client.password_reset_tokens.updateMany.mockResolvedValue({ count: 0 } as any);
    prisma.client.password_reset_tokens.create.mockResolvedValue({} as any);
    emailService.sendPasswordReset.mockResolvedValue(undefined);

    await useCase.execute({ email: 'User@TEST.COM' });

    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      'user@test.com',
      expect.stringContaining('token='),
    );
  });

  it('deve retornar { ok: true } sem gerar token quando email não existe (anti-enumeração)', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue(null);

    const result = await useCase.execute({ email: 'nao-existe@test.com' });

    expect(result).toEqual({ ok: true });
    expect(prisma.client.password_reset_tokens.create).not.toHaveBeenCalled();
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('deve retornar { ok: true } sem token quando email sem auth_id', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue({
      auth_id: null,
    } as any);

    const result = await useCase.execute({ email: 'legado@test.com' });

    expect(result).toEqual({ ok: true });
    expect(prisma.client.password_reset_tokens.create).not.toHaveBeenCalled();
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('deve invalidar tokens anteriores antes de criar um novo', async () => {
    prisma.client.usuarios.findFirst.mockResolvedValue({
      auth_id: 'auth-id-1',
    } as any);
    prisma.client.password_reset_tokens.updateMany.mockResolvedValue({
      count: 2,
    } as any);
    prisma.client.password_reset_tokens.create.mockResolvedValue({} as any);
    emailService.sendPasswordReset.mockResolvedValue(undefined);

    await useCase.execute({ email: 'user@test.com' });

    expect(prisma.client.password_reset_tokens.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { auth_id: 'auth-id-1', used_at: null },
        data: expect.objectContaining({ used_at: expect.any(Date) }),
      }),
    );

    const updateManyOrder = (
      prisma.client.password_reset_tokens.updateMany as jest.Mock
    ).mock.invocationCallOrder[0];
    const createOrder = (
      prisma.client.password_reset_tokens.create as jest.Mock
    ).mock.invocationCallOrder[0];
    expect(updateManyOrder).toBeLessThan(createOrder);
  });
});
