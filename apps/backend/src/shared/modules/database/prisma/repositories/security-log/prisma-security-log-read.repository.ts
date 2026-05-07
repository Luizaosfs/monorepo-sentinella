import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';
import { ListSecurityLogsInputType } from '@modules/security-log/dtos/list-security-logs.input';
import {
  SecurityLogPage,
  SecurityLogReadRepository,
  SecurityLogStats,
} from '@modules/security-log/repositories/security-log-read.repository';

import { PrismaSecurityLogMapper } from '../../mappers/prisma-security-log.mapper';
import { PrismaService } from '../../prisma.service';

const DEFAULT_DAYS = 30;

type RawRow = {
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

@PrismaRepository(SecurityLogReadRepository)
@Injectable()
export class PrismaSecurityLogReadRepository implements SecurityLogReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filter: ListSecurityLogsInputType): Promise<SecurityLogPage> {
    const de = filter.de ?? this.daysAgo(DEFAULT_DAYS);
    const ate = filter.ate ?? new Date();
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`created_at >= ${de}`,
      Prisma.sql`created_at <= ${ate}`,
    ];

    if (filter.eventType) conditions.push(Prisma.sql`event_type = ${filter.eventType}`);
    if (filter.severity)  conditions.push(Prisma.sql`severity = ${filter.severity}`);
    if (filter.ip)        conditions.push(Prisma.sql`ip = ${filter.ip}`);
    if (filter.userId)    conditions.push(Prisma.sql`user_id = ${filter.userId}`);
    if (filter.clienteId) conditions.push(Prisma.sql`cliente_id = ${filter.clienteId}::uuid`);

    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const [rows, countResult] = await Promise.all([
      this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT id, event_type, severity, user_id, cliente_id, role,
               ip, user_agent, method, path, status_code, message, metadata, created_at
        FROM security_log
        ${where}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `),
      this.prisma.client.$queryRaw<{ total: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM security_log
        ${where}
      `),
    ]);

    const total = Number(countResult[0]?.total ?? 0);

    return {
      data: rows.map(PrismaSecurityLogMapper.toDomain),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      period: { de, ate },
    };
  }

  async stats(days: number): Promise<SecurityLogStats> {
    const de = new Date();
    de.setDate(de.getDate() - days);
    const ate = new Date();

    const [byEventType, bySeverity, topIps, topPaths] = await Promise.all([
      this.prisma.client.$queryRaw<{ event_type: string; total: bigint }[]>(Prisma.sql`
        SELECT event_type, COUNT(*)::bigint AS total
        FROM security_log
        WHERE created_at >= ${de}
        GROUP BY event_type
        ORDER BY total DESC
      `),
      this.prisma.client.$queryRaw<{ severity: string; total: bigint }[]>(Prisma.sql`
        SELECT severity, COUNT(*)::bigint AS total
        FROM security_log
        WHERE created_at >= ${de}
        GROUP BY severity
        ORDER BY total DESC
      `),
      this.prisma.client.$queryRaw<{ ip: string; total: bigint }[]>(Prisma.sql`
        SELECT ip, COUNT(*)::bigint AS total
        FROM security_log
        WHERE created_at >= ${de}
          AND ip IS NOT NULL
        GROUP BY ip
        ORDER BY total DESC
        LIMIT 10
      `),
      this.prisma.client.$queryRaw<{ path: string; total: bigint }[]>(Prisma.sql`
        SELECT path, COUNT(*)::bigint AS total
        FROM security_log
        WHERE created_at >= ${de}
          AND path IS NOT NULL
        GROUP BY path
        ORDER BY total DESC
        LIMIT 10
      `),
    ]);

    return {
      period: { de, ate, days },
      byEventType: byEventType.map((r) => ({ eventType: r.event_type, total: Number(r.total) })),
      bySeverity: bySeverity.map((r) => ({ severity: r.severity, total: Number(r.total) })),
      topIps: topIps.map((r) => ({ ip: r.ip, total: Number(r.total) })),
      topPaths: topPaths.map((r) => ({ path: r.path, total: Number(r.total) })),
    };
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }
}
