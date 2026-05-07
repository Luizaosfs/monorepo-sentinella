import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SecurityLoggerService } from '@modules/security-log/security-log.service';
import { SecurityEventType, SecuritySeverity } from '@modules/security-log/security-log.types';
import { Request, Response } from 'express';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly securityLogger: SecurityLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as Record<string, unknown>)['message'] as string | string[] ?? message;
      }
    } else {
      this.logger.error(
        `Unhandled exception: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    this.logSecurityEvent(request, status, exception);

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private logSecurityEvent(request: Request, status: number, exception: unknown): void {
    const user = (request as any)['user'];
    const base = {
      userId: user?.id ?? null,
      clienteId: user?.clienteId ?? null,
      role: user?.papeis?.join(',') ?? null,
      ip: request.ip ?? null,
      userAgent: (request.headers['user-agent'] as string) ?? null,
      method: request.method,
      path: request.url,
      statusCode: status,
    };

    if (status === 429) {
      void this.securityLogger.log({
        ...base,
        eventType: SecurityEventType.RATE_LIMIT_BLOCKED,
        severity: SecuritySeverity.WARN,
        message: 'Rate limit excedido',
      });
      return;
    }

    if (status === 401) {
      // TOKEN_INVALID e LOGIN_FAILED já são logados no AuthGuard com mais contexto.
      // O filter só loga 401s que vieram de fora do AuthGuard (ex.: endpoint sem guard).
      return;
    }

    if (status === 403) {
      // ACCESS_DENIED e TENANT_VIOLATION já são logados nos guards com contexto completo.
      return;
    }

    if (status >= 500) {
      const errorName = exception instanceof Error ? exception.constructor.name : 'UnknownError';
      void this.securityLogger.log({
        ...base,
        eventType: SecurityEventType.INTERNAL_ERROR,
        severity: SecuritySeverity.ERROR,
        message: 'Erro interno do servidor',
        // Stack trace nunca vai para o banco — apenas o tipo do erro
        metadata: { errorName },
      });
    }
  }
}
