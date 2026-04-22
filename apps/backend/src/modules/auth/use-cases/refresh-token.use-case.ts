import { HttpException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as crypto from 'crypto';
import { AuthException } from 'src/guards/errors/auth.exception';
import { env } from 'src/lib/env/server';

import { RefreshBody } from '../dtos/refresh.body';
import { buildAuthUser } from './_helpers/build-auth-user';

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async execute(input: RefreshBody) {
    try {
      return await this.executeInternal(input);
    } catch (err) {
      // HttpException já é tratada (401/403 etc) — propagar sem logar
      if (err instanceof HttpException) throw err;
      // Erro inesperado (Prisma, transação, etc) — logar e devolver 401 limpo
      this.logger.error(
        `Erro inesperado em /auth/refresh: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw AuthException.refreshTokenInvalid();
    }
  }

  private async executeInternal(input: RefreshBody) {
    let decoded: any;

    try {
      decoded = await this.jwtService.verifyAsync(input.refreshToken, {
        secret: env.SECRET_JWT,
        audience: 'sentinella-api',
        issuer: 'sentinella-auth',
      });
    } catch {
      throw AuthException.refreshTokenExpired();
    }

    if (decoded.type !== 'refresh' || !decoded.sub) {
      throw AuthException.refreshTokenInvalid();
    }

    // Valida token na whitelist — rejeita tokens usados, revogados ou expirados
    const tokenHash = crypto.createHash('sha256').update(input.refreshToken).digest('hex');
    const tokenRecord = await this.prisma.client.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!tokenRecord) throw AuthException.refreshTokenInvalid();
    if (tokenRecord.used_at) throw AuthException.refreshTokenAlreadyUsed();
    if (tokenRecord.revoked_at) throw AuthException.refreshTokenRevoked();
    if (tokenRecord.expires_at < new Date()) throw AuthException.refreshTokenExpired();

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
      { secret: env.SECRET_JWT, expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as any },
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
