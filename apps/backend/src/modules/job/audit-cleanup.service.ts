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

  /**
   * LGPD: nullifica campos sensíveis após prazos — NÃO deleta registros
   * (preserva rastreabilidade).
   */
  async redactSensitiveFields(): Promise<{
    esusRespostaApi: number;
    analiseIaClusters: number;
  }> {
    // a) item_notificacoes_esus.resposta_api → NULL após 90 dias
    const esusResult = await this.prisma.client.$executeRaw`
      UPDATE item_notificacoes_esus
      SET resposta_api = NULL,
          resposta_redacted_at = NOW()
      WHERE resposta_api IS NOT NULL
        AND resposta_redacted_at IS NULL
        AND created_at < NOW() - INTERVAL '90 days'
    `;

    // b) levantamento_analise_ia.clusters → NULL após 1 ano
    const iaResult = await this.prisma.client.$executeRaw`
      UPDATE levantamento_analise_ia
      SET clusters = NULL,
          clusters_redacted_at = NOW()
      WHERE clusters IS NOT NULL
        AND clusters_redacted_at IS NULL
        AND created_at < NOW() - INTERVAL '1 year'
    `;

    const esusRespostaApi = Number(esusResult);
    const analiseIaClusters = Number(iaResult);

    this.logger.log(
      `[AuditCleanupService.redactSensitiveFields] esus=${esusRespostaApi} ia_clusters=${analiseIaClusters}`,
    );

    return { esusRespostaApi, analiseIaClusters };
  }
}
