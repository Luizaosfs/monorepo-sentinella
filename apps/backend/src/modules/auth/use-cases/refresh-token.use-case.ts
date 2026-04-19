import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as crypto from 'crypto';
import { AuthException } from 'src/guards/errors/auth.exception';
import { env } from 'src/lib/env/server';

import { RefreshBody } from '../dtos/refresh.body';
import { buildAuthUser } from './_helpers/build-auth-user';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async execute(input: RefreshBody) {
    let decoded: any;

    try {
      decoded = await this.jwtService.verifyAsync(input.refreshToken, {
        secret: env.SECRET_JWT,
      });
    } catch {
      throw AuthException.unauthorized();
    }

    if (decoded.type !== 'refresh' || !decoded.sub) {
      throw AuthException.unauthorized();
    }

    // Valida token na whitelist — rejeita tokens usados, revogados ou expirados
    const tokenHash = crypto.createHash('sha256').update(input.refreshToken).digest('hex');
    const tokenRecord = await this.prisma.client.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!tokenRecord || tokenRecord.used_at || tokenRecord.revoked_at || tokenRecord.expires_at < new Date()) {
      throw AuthException.unauthorized();
    }

    const usuario = await this.prisma.client.usuarios.findUnique({
      where: { auth_id: decoded.sub },
      include: { papeis_usuarios: true },
    });

    if (!usuario || !usuario.ativo) {
      throw AuthException.inactiveUser();
    }

    const papeis = usuario.papeis_usuarios.map((p) => p.papel);

    const payload = {
      sub: usuario.auth_id,
      email: usuario.email,
      nome: usuario.nome,
      clienteId: usuario.cliente_id,
      papeis,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env.SECRET_JWT,
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const newRefreshToken = await this.jwtService.signAsync(
      { sub: usuario.auth_id, type: 'refresh' },
      { secret: env.SECRET_JWT, expiresIn: '30d' },
    );

    // Rotação: invalida token anterior e registra o novo
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await this.prisma.client.$transaction([
      this.prisma.client.refresh_tokens.update({
        where: { id: tokenRecord.id },
        data: { used_at: new Date() },
      }),
      this.prisma.client.refresh_tokens.create({
        data: {
          auth_id: usuario.auth_id!,
          token_hash: newTokenHash,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return { accessToken, refreshToken: newRefreshToken, user: buildAuthUser(usuario, papeis) };
  }
}
