import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AuthException } from 'src/guards/errors/auth.exception';
import { env } from 'src/lib/env/server';

import { LoginBody } from '../dtos/login.body';
import { buildAuthUser } from './_helpers/build-auth-user';

@Injectable()
export class LoginUseCase {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async execute(input: LoginBody) {
    // Busca por email (case-insensitive — registros legados podem não estar em minúsculas)
    const emailTrim = input.email.trim();
    const usuario = await this.prisma.client.usuarios.findFirst({
      where: {
        email: { equals: emailTrim, mode: 'insensitive' },
      },
      include: { papeis_usuarios: true },
    });

    if (!usuario) {
      throw AuthException.invalidCredentials();
    }

    if (!usuario.ativo) {
      throw AuthException.inactiveUser();
    }

    if (!usuario.auth_id) {
      throw AuthException.notLinked();
    }

    const senhaHash = usuario.senha_hash;
    if (!senhaHash) throw AuthException.invalidCredentials();

    const senhaValida = await bcrypt.compare(input.password, senhaHash);
    if (!senhaValida) throw AuthException.invalidCredentials();

    const papeis = usuario.papeis_usuarios.map((p) => p.papel);

    const payload = {
      sub: usuario.auth_id,   // auth.users.id — identidade canônica no JWT
      email: usuario.email,
      nome: usuario.nome,
      clienteId: usuario.cliente_id,
      papeis,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env.SECRET_JWT,
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: usuario.auth_id, type: 'refresh' },
      { secret: env.SECRET_JWT, expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as any },
    );

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.client.refresh_tokens.create({
      data: {
        auth_id: usuario.auth_id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: buildAuthUser(usuario, papeis),
    };
  }
}
