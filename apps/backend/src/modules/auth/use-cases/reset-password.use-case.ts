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

    const updated = await this.prisma.client.$executeRaw`
      UPDATE auth.users
      SET encrypted_password = ${novoHash},
          updated_at          = now()
      WHERE id = ${record.auth_id}::uuid
    `;

    if (updated === 0) throw AuthException.unauthorized();

    // Invalida o token
    await this.prisma.client.password_reset_tokens.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    });

    return { ok: true };
  }
}
