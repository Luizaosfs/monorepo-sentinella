import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

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
      Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
      Boolean(process.env.CLOUDINARY_API_KEY) &&
      Boolean(process.env.CLOUDINARY_API_SECRET);

    // Anthropic API (variável configurada)
    checks.anthropic = Boolean(process.env.ANTHROPIC_API_KEY);

    // VAPID (push notifications)
    checks.vapid =
      Boolean(process.env.VAPID_PUBLIC_KEY) &&
      Boolean(process.env.VAPID_PRIVATE_KEY);

    const allOk = Object.values(checks).every(Boolean);
    const status = allOk ? 'ok' : 'degraded';

    this.logger.log(`[HealthCheckService.check] status=${status} checks=${JSON.stringify(checks)}`);
    return { status, checks };
  }
}
