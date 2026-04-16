import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class AuditCleanupService {
  private readonly logger = new Logger(AuditCleanupService.name);

  constructor(private prisma: PrismaService) {}

  async cleanupLogs(): Promise<{ deletados: number }> {
    let deletados = 0;

    // Audit logs com mais de 90 dias
    const auditResult = await this.prisma.client.$executeRaw`
      DELETE FROM audit_log
      WHERE created_at < NOW() - INTERVAL '90 days'
    `;
    deletados += Number(auditResult);

    // Offline sync logs expirados
    const offlineResult = await this.prisma.client.$executeRaw`
      DELETE FROM offline_sync_log
      WHERE retention_until < NOW()
    `;
    deletados += Number(offlineResult);

    // Rate limit do canal cidadão com mais de 24h
    const rateLimitResult = await this.prisma.client.$executeRaw`
      DELETE FROM canal_cidadao_rate_limit
      WHERE janela_hora < NOW() - INTERVAL '24 hours'
    `;
    deletados += Number(rateLimitResult);

    this.logger.log(`[AuditCleanupService.cleanupLogs] deletados=${deletados}`);
    return { deletados };
  }
}
