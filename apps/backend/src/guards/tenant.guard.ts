import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * TenantGuard garante que o usuário tem cliente_id vinculado.
 * Admins (sem cliente_id) podem acessar qualquer tenant via query param ?clienteId=xxx.
 * Supervisors/Agentes só acessam dados do próprio cliente_id do JWT.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request['user'];

    if (!user) return false;

    const isAdmin = user.isPlatformAdmin;

    if (isAdmin) {
      // Admin pode escolher tenant via query param ou body.
      // Usa null (explícito) quando não informado — nunca undefined,
      // pois undefined remove o filtro de cliente_id em queries Prisma.
      const clienteId = request.query?.clienteId ?? request.body?.clienteId ?? null;
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
