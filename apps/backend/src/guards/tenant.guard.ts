import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { SKIP_TENANT_KEY } from '@/decorators/roles.decorator';
import {
  AccessScope,
  MunicipalScope,
  PlatformScope,
  RegionalScope,
} from '@/shared/security/access-scope';
import { AuthenticatedUser } from './auth.guard';

/**
 * TenantGuard popula `req.accessScope` baseado no papel do usuário.
 *
 * Variantes resultantes:
 * - admin → PlatformScope (tenantId = ?clienteId | null; clienteIdsPermitidos = [tenantId] | null)
 * - supervisor/agente/notificador → MunicipalScope (tenantId = user.clienteId)
 * - analista_regional → RegionalScope (tenantId = ?clienteId validado | null; lista de clientes do agrupamento)
 *
 * Mantém compatibilidade temporária populando também `req.tenantId` (removido em 1B/1C).
 *
 * Registrado como APP_GUARD global. Opt-outs:
 *   - @Public(): sem auth
 *   - @SkipTenant(): autenticado mas sem tenant (auth/me, logout)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipTenant = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipTenant) return true;

    const request = context.switchToHttp().getRequest();
    const user = request['user'] as AuthenticatedUser | undefined;

    if (!user) return false;

    const scope = await this.buildAccessScope(user, request);

    request['accessScope'] = scope;

    // Compatibilidade temporária — fase 1B/1C migra os callers
    request['tenantId'] = scope.tenantId;

    return true;
  }

  private async buildAccessScope(
    user: AuthenticatedUser,
    request: any,
  ): Promise<AccessScope> {
    if (user.isPlatformAdmin) {
      const clienteId =
        (request.query?.clienteId as string | undefined) ?? null;
      return {
        kind: 'platform',
        userId: user.id,
        papeis: user.papeis,
        isAdmin: true,
        tenantId: clienteId,
        clienteIdsPermitidos: clienteId ? [clienteId] : null,
        agrupamentoId: null,
      } satisfies PlatformScope;
    }

    if (user.papeis.includes('analista_regional')) {
      if (!user.agrupamentoId) {
        throw new ForbiddenException(
          'Analista regional sem agrupamento vinculado',
        );
      }

      const rows = await this.prisma.client.agrupamento_cliente.findMany({
        where: { agrupamento_id: user.agrupamentoId },
        select: { cliente_id: true },
      });
      const clienteIds = rows.map((r) => r.cliente_id);

      if (clienteIds.length === 0) {
        throw new ForbiddenException('Agrupamento sem clientes vinculados');
      }

      const requestedClienteId = (request.query?.clienteId as string | undefined) ?? null;
      if (requestedClienteId && !clienteIds.includes(requestedClienteId)) {
        throw new ForbiddenException('Município não pertence ao seu agrupamento');
      }

      return {
        kind: 'regional',
        userId: user.id,
        papeis: user.papeis,
        isAdmin: false,
        tenantId: requestedClienteId,
        clienteIdsPermitidos: clienteIds,
        agrupamentoId: user.agrupamentoId,
      } satisfies RegionalScope;
    }

    if (!user.clienteId) {
      throw new ForbiddenException('Usuário sem vínculo a município');
    }

    return {
      kind: 'municipal',
      userId: user.id,
      papeis: user.papeis,
      isAdmin: false,
      tenantId: user.clienteId,
      clienteIdsPermitidos: [user.clienteId],
      agrupamentoId: null,
    } satisfies MunicipalScope;
  }
}
