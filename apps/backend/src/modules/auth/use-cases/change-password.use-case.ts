import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { AuthException } from 'src/guards/errors/auth.exception';

import { ChangePasswordBody } from '../dtos/change-password.body';

@Injectable()
export class ChangePasswordUseCase {
  constructor(private prisma: PrismaService) {}

  async execute(user: AuthenticatedUser, input: ChangePasswordBody): Promise<{ ok: true }> {
    const authId = user.sub;

    const rows = await this.prisma.client.$queryRaw<
      Array<{ encrypted_password: string | null }>
    >`
      SELECT encrypted_password
      FROM auth.users
      WHERE id = ${authId}::uuid
      LIMIT 1
    `;

    const hash = rows[0]?.encrypted_password;
    if (!hash) throw AuthException.invalidCredentials();

    const senhaValida = await bcrypt.compare(input.currentPassword, hash);
    if (!senhaValida) throw AuthException.invalidCredentials();

    const novoHash = await bcrypt.hash(input.newPassword, 10);

    await this.prisma.client.$executeRaw`
      UPDATE auth.users
      SET encrypted_password = ${novoHash},
          updated_at          = now()
      WHERE id = ${authId}::uuid
    `;

    return { ok: true };
  }
}
