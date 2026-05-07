import { Prisma } from '@prisma/client';

import { SecurityLog } from 'src/modules/security-log/entities/security-log';
import { SecurityEventType, SecuritySeverity } from 'src/modules/security-log/security-log.types';

type RawSecurityLog = {
  id: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  cliente_id: string | null;
  role: string | null;
  ip: string | null;
  user_agent: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  message: string;
  metadata: Prisma.JsonValue | null;
  created_at: Date;
};

export class PrismaSecurityLogMapper {
  static toDomain(raw: RawSecurityLog): SecurityLog {
    return new SecurityLog(
      {
        eventType: raw.event_type as SecurityEventType,
        severity: raw.severity as SecuritySeverity,
        userId: raw.user_id,
        clienteId: raw.cliente_id,
        role: raw.role,
        ip: raw.ip,
        userAgent: raw.user_agent,
        method: raw.method,
        path: raw.path,
        statusCode: raw.status_code,
        message: raw.message,
        metadata: raw.metadata as Record<string, unknown> | null,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
      },
    );
  }
}
