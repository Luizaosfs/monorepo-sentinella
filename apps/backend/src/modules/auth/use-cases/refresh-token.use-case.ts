import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { AuthException } from 'src/guards/errors/auth.exception';
import { env } from 'src/lib/env/server';

import { RefreshBody } from '../dtos/refresh.body';

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

    const usuario = await this.prisma.client.usuarios.findUnique({
      where: { auth_id: decoded.sub },
      include: { papeis_usuarios: true },
    });

    if (!usuario || !usuario.ativo) {
      throw AuthException.inactiveUser();
    }

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
      { secret: env.SECRET_JWT, expiresIn: '30d' },
    );

    return { accessToken, refreshToken };
  }
}
