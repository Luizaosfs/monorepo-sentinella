export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TENANT_VIOLATION = 'TENANT_VIOLATION',
  RATE_LIMIT_BLOCKED = 'RATE_LIMIT_BLOCKED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PUBLIC_CHANNEL_ABUSE = 'PUBLIC_CHANNEL_ABUSE',
  CRITICAL_ACTION = 'CRITICAL_ACTION',
}

export enum SecuritySeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface SecurityLogPayload {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string | null;
  clienteId?: string | null;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  message: string;
  metadata?: Record<string, unknown> | null;
}
