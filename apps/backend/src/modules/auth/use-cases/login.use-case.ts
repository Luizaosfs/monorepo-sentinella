import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { AuthException } from 'src/guards/errors/auth.exception';
import { env } from 'src/lib/env/server';

import { LoginBody } from '../dtos/login.body';

@Injectable()
export class LoginUseCase {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async execute(input: LoginBody) {
    // Busca o usuário pelo email
    const usuario = await this.prisma.client.usuarios.findFirst({
      where: { email: input.email.toLowerCase().trim() },
      include: { papeis_usuarios: true },
    });

    if (!usuario) {
      throw AuthException.invalidCredentials();
    }

    if (!usuario.ativo) {
      throw AuthException.inactiveUser();
    }

    // Garante que o usuario tem auth_id vinculado (auth.users.id)
    if (!usuario.auth_id) {
      throw AuthException.notLinked();
    }

    // TODO: Na migração, o campo senha será adicionado à tabela usuarios.
    // Por ora, durante a transição do Supabase Auth, validar contra auth.users.
    // Quando a migração estiver completa, usar:
    // const senhaValida = await bcrypt.compare(input.password, usuario.senha_hash)

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

    return {
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,        // ID interno — para uso em relações do banco
        authId: usuario.auth_id,
        email: usuario.email,
        nome: usuario.nome,
        clienteId: usuario.cliente_id,
        papeis,
      },
    };
  }
}
