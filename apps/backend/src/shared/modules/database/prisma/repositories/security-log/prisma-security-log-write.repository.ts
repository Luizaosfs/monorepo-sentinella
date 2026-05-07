import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';
import { SecurityLogWriteRepository } from '@modules/security-log/repositories/security-log-write.repository';
import { SecurityLogPayload } from '@modules/security-log/security-log.types';

import { PrismaService } from '../../prisma.service';

@PrismaRepository(SecurityLogWriteRepository)
@Injectable()
export class PrismaSecurityLogWriteRepository implements SecurityLogWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: SecurityLogPayload): Promise<void> {
    const meta = payload.metadata ? JSON.stringify(payload.metadata) : null;

    await this.prisma.client.$executeRaw(Prisma.sql`
      INSERT INTO security_log (
        event_type, severity, user_id, cliente_id, role,
        ip, user_agent, method, path, status_code, message, metadata
      ) VALUES (
        ${payload.eventType},
        ${payload.severity},
        ${payload.userId ?? null},
        ${payload.clienteId ?? null}::uuid,
        ${payload.role ?? null},
        ${payload.ip ?? null},
        ${payload.userAgent ?? null},
        ${payload.method ?? null},
        ${payload.path ?? null},
        ${payload.statusCode ?? null},
        ${payload.message},
        ${meta}::jsonb
      )
    `);
  }
}
