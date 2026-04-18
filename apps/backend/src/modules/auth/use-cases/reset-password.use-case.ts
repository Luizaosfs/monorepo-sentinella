import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AuthException } from 'src/guards/errors/auth.exception';

import { ResetPasswordBody } from '../dtos/reset-password.body';

@Injectable()
export class ResetPasswordUseCase {
  constructor(private prisma: PrismaService) {}

  async execute(input: ResetPasswordBody): Promise<{ ok: true }> {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

    const record = await this.prisma.client.password_reset_tokens.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!record || record.used_at || record.expires_at < new Date()) {
      throw AuthException.unauthorized();
    }

    const novoHash = await bcrypt.hash(input.newPassword, 10);

    try {
      await this.prisma.client.usuarios.update({
        where: { auth_id: record.auth_id },
        data: { senha_hash: novoHash, updated_at: new Date() },
      });
    } catch (err: any) {
      if (err?.code === 'P2025') throw AuthException.unauthorized();
      throw err;
    }

    // Invalida o token
    await this.prisma.client.password_reset_tokens.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    });

    return { ok: true };
  }
}
