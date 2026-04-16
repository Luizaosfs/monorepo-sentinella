import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { env } from 'src/lib/env/server';

import { PapelApp } from '@/decorators/roles.decorator';

import { AuthException } from './errors/auth.exception';

/** Usuário autenticado injetado em `request.user` após o AuthGuard. */
export type AuthenticatedUser = {
  /** `usuarios.id` — identificador interno (FKs de domínio: created_by, alterado_por, etc.). */
  id: string;
  /** `usuarios.auth_id` = JWT `sub` = `auth.users.id`. */
  authId: string;
  email: string;
  nome: string;
  clienteId: string | null;
  papeis: PapelApp[];
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw AuthException.unauthorized();
    }

    // Tenta validar como NestJS JWT primeiro; se falhar e SUPABASE_JWT_SECRET
    // estiver configurado, tenta como Supabase JWT (bridge de migração).
    let authId: string | undefined;

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: env.SECRET_JWT,
      });
      if (!payload?.sub) throw AuthException.unauthorized();
      authId = payload.sub as string;
    } catch (nestErr) {
      if (nestErr instanceof UnauthorizedException) throw nestErr;

      // Bridge: aceita token Supabase durante a migração
      if (!env.SUPABASE_JWT_SECRET) throw AuthException.unauthorized();
      try {
        const sbPayload = await this.jwtService.verifyAsync(token, {
          secret: env.SUPABASE_JWT_SECRET,
        });
        if (!sbPayload?.sub) throw AuthException.unauthorized();
        authId = sbPayload.sub as string;
      } catch {
        throw AuthException.unauthorized();
      }
    }

    try {
      // Busca usuário pelo auth_id (= auth.users.id = JWT.sub)
      const usuario = await this.prisma.client.usuarios.findUnique({
        where: { auth_id: authId },
        include: { papeis_usuarios: true },
      });

      if (!usuario?.ativo) {
        throw AuthException.unauthorized();
      }

      // Injeta no request (id = domínio; authId = identidade externa do token)
      request['user'] = {
        id: usuario.id,
        authId: usuario.auth_id!,
        email: usuario.email,
        nome: usuario.nome,
        clienteId: usuario.cliente_id,
        papeis: usuario.papeis_usuarios.map((p) => p.papel),
      } satisfies AuthenticatedUser;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw AuthException.unauthorized();
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
