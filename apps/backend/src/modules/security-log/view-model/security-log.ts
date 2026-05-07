import { SecurityLog } from '../entities/security-log';

export class SecurityLogViewModel {
  static toHttp(log: SecurityLog) {
    return {
      id: log.id,
      eventType: log.eventType,
      severity: log.severity,
      userId: log.userId ?? null,
      clienteId: log.clienteId ?? null,
      role: log.role ?? null,
      ip: log.ip ?? null,
      method: log.method ?? null,
      path: log.path ?? null,
      statusCode: log.statusCode ?? null,
      message: log.message,
      metadata: log.metadata ?? null,
      createdAt: log.createdAt,
    };
  }
}
