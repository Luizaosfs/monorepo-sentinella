import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as crypto from 'crypto';
import { env } from 'src/lib/env/server';

import { EmailService } from '../email.service';
import { ForgotPasswordBody } from '../dtos/forgot-password.body';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async execute(input: ForgotPasswordBody): Promise<{ ok: true }> {
    // Busca auth_id pelo email — nunca revela se o email existe (anti-enumeration)
    const rows = await this.prisma.client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM auth.users WHERE email = ${input.email} LIMIT 1
    `;

    if (rows.length) {
      const authId = rows[0].id;
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      // Invalida tokens anteriores não usados para o mesmo usuário
      await this.prisma.client.$executeRaw`
        UPDATE password_reset_tokens
        SET used_at = now()
        WHERE auth_id = ${authId}::uuid AND used_at IS NULL
      `;

      await this.prisma.client.password_reset_tokens.create({
        data: { auth_id: authId, token_hash: tokenHash, expires_at: expiresAt },
      });

      const baseUrl = env.CLIENT_URL ?? 'http://localhost:5173';
      const redirectTo = input.redirectTo ?? `${baseUrl}/reset-password`;
      const resetUrl = `${redirectTo}?token=${token}`;

      await this.emailService.sendPasswordReset(input.email, resetUrl);
    }

    return { ok: true };
  }
}
