import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
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
  /** Preenchido apenas para `analista_regional` — null para todos os outros papéis. */
  agrupamentoId: string | null;
  papeis: PapelApp[];
  /** `true` quando `papeis` inclui `'admin'`. Use este campo — nunca `papeis.includes('admin')` direto. */
  isPlatformAdmin: boolean;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

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

    let authId: string | undefined;
    const t0 = Date.now();

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: env.SECRET_JWT,
        audience: 'sentinella-api',
        issuer: 'sentinella-auth',
      });
      if (!payload?.sub) throw AuthException.unauthorized();
      authId = payload.sub as string;
      this.logger.debug(
        JSON.stringify({
          event: 'auth.jwt.nestjs',
          authId,
          latencyMs: Date.now() - t0,
        }),
      );
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`JWT inválido: ${(err as Error).message}`);
      throw AuthException.unauthorized();
    }

    try {
      // Busca usuário pelo auth_id (= auth.users.id = JWT.sub)
      const usuario = await this.prisma.client.usuarios.findUnique({
        where: { auth_id: authId },
        include: { papeis_usuarios: true },
      });

      if (!usuario) {
        this.logger.warn(
          `AuthGuard: usuario nao encontrado para auth_id=${authId}`,
        );
        throw AuthException.unauthorized();
      }
      if (!usuario.ativo) {
        this.logger.warn(`AuthGuard: usuario inativo auth_id=${authId}`);
        throw AuthException.unauthorized();
      }

      // Injeta no request (id = domínio; authId = identidade externa do token)
      const papeis = usuario.papeis_usuarios.map((p) => p.papel as PapelApp);
      request['user'] = {
        id: usuario.id,
        authId: usuario.auth_id!,
        email: usuario.email,
        nome: usuario.nome,
        clienteId: usuario.cliente_id,
        agrupamentoId: usuario.agrupamento_id ?? null,
        papeis,
        isPlatformAdmin: papeis.includes('admin'),
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
