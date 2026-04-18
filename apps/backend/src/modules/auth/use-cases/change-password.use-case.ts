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
    const authId = user.authId;

    const usuarioRow = await this.prisma.client.usuarios.findUnique({
      where: { auth_id: authId },
      select: { senha_hash: true },
    });

    const hashAtual = usuarioRow?.senha_hash ?? null;
    if (!hashAtual) throw AuthException.invalidCredentials();

    const senhaValida = await bcrypt.compare(input.currentPassword, hashAtual);
    if (!senhaValida) throw AuthException.invalidCredentials();

    const novoHash = await bcrypt.hash(input.newPassword, 10);

    await this.prisma.client.usuarios.update({
      where: { auth_id: authId },
      data: { senha_hash: novoHash, updated_at: new Date() },
    });

    return { ok: true };
  }
}
