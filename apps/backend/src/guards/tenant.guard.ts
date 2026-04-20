import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SKIP_TENANT_KEY } from '@/decorators/roles.decorator';

/**
 * TenantGuard garante que o usuário tem cliente_id vinculado.
 * Admins (sem cliente_id) podem acessar qualquer tenant via query param ?clienteId=xxx.
 * Supervisors/Agentes só acessam dados do próprio cliente_id do JWT.
 *
 * Registrado como APP_GUARD global: toda rota autenticada é protegida por padrão.
 * Opt-outs explícitos:
 *   - @Public(): rotas sem autenticação (auth/login, health, denuncia cidadão, etc.)
 *   - @SkipTenant(): rotas autenticadas que não operam sobre tenant (auth/me, auth/logout, etc.)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    const user = request['user'];

    if (!user) return false;

    const isAdmin = user.isPlatformAdmin;

    if (isAdmin) {
      // Admin pode escolher tenant via query param APENAS.
      // Body é ignorado para impedir sobrescrita acidental de tenant em PATCH/PUT/DELETE.
      const clienteId = (request.query?.clienteId as string | undefined) ?? null;
      request['tenantId'] = clienteId;
      return true;
    }

    // Não-admin precisa ter cliente_id no JWT
    if (!user.clienteId) {
      throw new ForbiddenException('Usuário sem vínculo a município');
    }

    request['tenantId'] = user.clienteId;
    return true;
  }
}
