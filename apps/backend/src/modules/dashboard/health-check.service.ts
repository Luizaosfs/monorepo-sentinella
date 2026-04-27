import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { env } from 'src/lib/env/server';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);

  constructor(private prisma: PrismaService) {}

  async check(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {};

    // Banco de dados
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Cloudinary (variáveis configuradas)
    checks.cloudinary =
      Boolean(env.CLOUDINARY_CLOUD_NAME) &&
      Boolean(env.CLOUDINARY_API_KEY) &&
      Boolean(env.CLOUDINARY_API_SECRET);

    // Anthropic API (variável configurada)
    checks.anthropic = Boolean(env.ANTHROPIC_API_KEY);

    // VAPID (push notifications)
    checks.vapid =
      Boolean(env.VAPID_PUBLIC_KEY) &&
      Boolean(env.VAPID_PRIVATE_KEY);

    const allOk = Object.values(checks).every(Boolean);
    const status = allOk ? 'ok' : 'degraded';

    this.logger.log(`[HealthCheckService.check] status=${status} checks=${JSON.stringify(checks)}`);
    return { status, checks };
  }

  async migrationHealth(): Promise<{
    senha_hash: { total: number; pendentes: number; percentual_migrado: number };
    canal_cidadao_v2_ativo: boolean;
  }> {
    const result = await this.prisma.client.$queryRaw<
      Array<{ total: bigint; pendentes: bigint }>
    >`
      SELECT
        COUNT(*)                                                              AS total,
        COUNT(*) FILTER (WHERE auth_id IS NOT NULL AND senha_hash IS NULL)   AS pendentes
      FROM public.usuarios
    `;

    const total = Number(result[0]?.total ?? 0);
    const pendentes = Number(result[0]?.pendentes ?? 0);
    const migrados = total - pendentes;
    const percentual_migrado = total === 0 ? 100 : Math.round((migrados / total) * 100);

    return {
      senha_hash: { total, pendentes, percentual_migrado },
      canal_cidadao_v2_ativo: env.CANAL_CIDADAO_V2_ENABLED,
    };
  }

  /**
   * Equivalente ao pg_cron `health-check-job` do Supabase legado.
   * Ping de sanidade a cada 5 minutos.
   */
  @Cron('*/5 * * * *')
  async healthCheckCron() {
    try {
      const result = await this.check();
      if (result.status !== 'ok') {
        this.logger.warn(`[HealthCheckService.healthCheckCron] status=${result.status}`);
      }
    } catch (err: unknown) {
      this.logger.error(
        `[HealthCheckService.healthCheckCron] falhou: ${(err as Error).message ?? err}`,
      );
    }
  }
}
