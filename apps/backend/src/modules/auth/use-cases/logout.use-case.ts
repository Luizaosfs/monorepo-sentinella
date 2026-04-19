import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class LogoutUseCase {
  constructor(private prisma: PrismaService) {}

  async execute(refreshToken: string): Promise<{ ok: true }> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await this.prisma.client.refresh_tokens.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    return { ok: true };
  }
}
