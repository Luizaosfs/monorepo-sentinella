import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PapelApp, ROLES_KEY } from '@/decorators/roles.decorator';

import { AuthException } from './errors/auth.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PapelApp[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user?.papeis) {
      throw AuthException.unauthorized();
    }

    // H-02 fix: admin tem acesso total — bypassa verificação de papéis
    const hasRole = user.isPlatformAdmin || requiredRoles.some((role) => user.papeis.includes(role));

    if (!hasRole) {
      throw AuthException.unauthorized();
    }

    return true;
  }
}
