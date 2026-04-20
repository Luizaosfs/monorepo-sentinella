import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as crypto from 'crypto';
import { env } from 'src/lib/env/server';

import { EmailService } from '../email.service';
import { ForgotPasswordBody } from '../dtos/forgot-password.body';

function resolveSafeRedirect(baseUrl: string, redirectTo: string | undefined): string {
  const fallback = `${baseUrl}/reset-password`;
  if (!redirectTo) return fallback;

  let parsedBase: URL;
  let parsedTarget: URL;
  try {
    parsedBase = new URL(baseUrl);
    parsedTarget = new URL(redirectTo);
  } catch {
    return fallback;
  }

  if (parsedBase.origin !== parsedTarget.origin) return fallback;
  if (parsedTarget.username || parsedTarget.password) return fallback;
  if (!parsedTarget.pathname.startsWith('/reset-password')) return fallback;

  return `${parsedTarget.origin}${parsedTarget.pathname.replace(/\/$/, '')}`;
}

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async execute(input: ForgotPasswordBody): Promise<{ ok: true }> {
    const emailNormalizado = input.email.trim().toLowerCase();
    // Fase 3: busca auth_id em usuarios (não mais em auth.users)
    // Funciona para usuários novos (sem auth.users) e legados (com auth.users)
    const usuarioRow = await this.prisma.client.usuarios.findFirst({
      where: { email: { equals: emailNormalizado, mode: 'insensitive' } },
      select: { auth_id: true },
    });

    if (usuarioRow?.auth_id) {
      const authId = usuarioRow.auth_id;
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      // Invalida tokens anteriores não usados para o mesmo usuário
      await this.prisma.client.password_reset_tokens.updateMany({
        where: { auth_id: authId, used_at: null },
        data: { used_at: new Date() },
      });

      await this.prisma.client.password_reset_tokens.create({
        data: { auth_id: authId, token_hash: tokenHash, expires_at: expiresAt },
      });

      const baseUrl = (env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
      const safeRedirect = resolveSafeRedirect(baseUrl, input.redirectTo);
      const resetUrl = `${safeRedirect}?token=${token}`;

      await this.emailService.sendPasswordReset(emailNormalizado, resetUrl);
    }

    return { ok: true };
  }
}
