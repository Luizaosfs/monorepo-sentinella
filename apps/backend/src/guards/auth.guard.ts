import * as crypto from 'crypto';

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
  papeis: PapelApp[];
};

@Injectable()
export class AuthGuard implements CanActivate {
  /** Cache kid → PEM para não buscar JWKS em todo request. */
  private readonly jwksCache = new Map<string, string>();
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  private async getSupabasePublicKey(kid: string): Promise<string | null> {
    if (this.jwksCache.has(kid)) return this.jwksCache.get(kid)!;

    const supabaseUrl = env.SUPABASE_URL;
    if (!supabaseUrl) return null;

    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
      const { keys } = await res.json() as { keys: Array<Record<string, unknown>> };
      for (const jwk of keys) {
        const pub = crypto.createPublicKey({ key: jwk as crypto.JsonWebKeyInput['key'], format: 'jwk' });
        const pem = pub.export({ type: 'spki', format: 'pem' }) as string;
        this.jwksCache.set(jwk['kid'] as string, pem);
      }
      return this.jwksCache.get(kid) ?? null;
    } catch (e) {
      this.logger.error(`Erro ao buscar JWKS: ${(e as Error).message}`);
      return null;
    }
  }

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

      // Bridge: aceita token Supabase durante a migração (HS256 ou ES256 via JWKS)
      try {
        const headerB64 = token.split('.')[0];
        const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString()) as { kid?: string; alg?: string };
        const kid = header.kid;

        if (!kid) {
          // HS256: projetos Supabase legados sem kid — usa SUPABASE_JWT_SECRET
          const secret = env.SUPABASE_JWT_SECRET;
          if (!secret) throw new Error('SUPABASE_JWT_SECRET não configurado');
          const sbPayload = await this.jwtService.verifyAsync(token, {
            secret,
            algorithms: ['HS256'],
          });
          if (!sbPayload?.sub) throw new Error('Token sem sub');
          authId = sbPayload.sub as string;
        } else {
          // ES256: projetos Supabase modernos com JWKS
          const publicKey = await this.getSupabasePublicKey(kid);
          if (!publicKey) throw new Error('Chave pública não encontrada para kid: ' + kid);
          const sbPayload = await this.jwtService.verifyAsync(token, {
            publicKey,
            algorithms: ['ES256'],
          });
          if (!sbPayload?.sub) throw new Error('Token sem sub');
          authId = sbPayload.sub as string;
        }
      } catch (sbErr) {
        this.logger.warn(`Supabase bridge falhou: ${(sbErr as Error).message}`);
        throw AuthException.unauthorized();
      }
    }

    try {
      // Busca usuário pelo auth_id (= auth.users.id = JWT.sub)
      const usuario = await this.prisma.client.usuarios.findUnique({
        where: { auth_id: authId },
        include: { papeis_usuarios: true },
      });

      if (!usuario) throw AuthException.unauthorized();
      if (!usuario.ativo) throw AuthException.unauthorized();

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
