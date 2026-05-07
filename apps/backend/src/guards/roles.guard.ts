import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityLoggerService } from '@modules/security-log/security-log.service';
import { SecurityEventType, SecuritySeverity } from '@modules/security-log/security-log.types';

import { PapelApp, ROLES_KEY } from '@/decorators/roles.decorator';

import { AuthException } from './errors/auth.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private securityLogger: SecurityLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PapelApp[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user?.papeis) {
      throw AuthException.unauthorized();
    }

    // H-02 fix: admin tem acesso total — bypassa verificação de papéis
    const hasRole = user.isPlatformAdmin || requiredRoles.some((role) => user.papeis.includes(role));

    if (!hasRole) {
      this.logger.warn(
        `RolesGuard: acesso negado user=${user.id} papeis=${user.papeis} required=${requiredRoles}`,
      );
      void this.securityLogger.log({
        eventType: SecurityEventType.ACCESS_DENIED,
        severity: SecuritySeverity.WARN,
        userId: user.id,
        clienteId: user.clienteId ?? null,
        role: user.papeis?.join(',') ?? null,
        ip: request.ip ?? null,
        userAgent: request.headers?.['user-agent'] ?? null,
        method: request.method,
        path: request.url,
        statusCode: 403,
        message: 'Acesso negado — papel insuficiente',
        metadata: { required: requiredRoles, actual: user.papeis },
      });
      throw AuthException.accessDenied();
    }

    return true;
  }
}
