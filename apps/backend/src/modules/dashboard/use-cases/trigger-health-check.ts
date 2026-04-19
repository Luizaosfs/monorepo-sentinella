import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { HealthCheckService } from '../health-check.service';

@Injectable()
export class TriggerHealthCheck {
  constructor(
    private prisma: PrismaService,
    private healthCheck: HealthCheckService,
  ) {}

  async execute() {
    const result = await this.healthCheck.check();

    await this.prisma.client.system_health_log.create({
      data: {
        servico: 'manual',
        status:  result.status,
        detalhes: result.checks as Prisma.InputJsonValue,
      },
    });

    return result;
  }
}
