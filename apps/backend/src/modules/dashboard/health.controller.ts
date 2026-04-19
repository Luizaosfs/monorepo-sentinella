import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';

import { Public, Roles } from '@/decorators/roles.decorator';
import { HealthCheckService } from './health-check.service';
import { TriggerHealthCheck } from './use-cases/trigger-health-check';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly triggerHealthCheckUc: TriggerHealthCheck,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness / readiness check (público, sem autenticação)' })
  async health(@Res() res: Response) {
    const result = await this.healthCheckService.check();
    res.status(result.status === 'ok' ? 200 : 503).json(result);
  }

  @UseGuards(TenantGuard)
  @Roles('admin')
  @Post('dashboard/health/trigger')
  @ApiOperation({ summary: 'Disparar health-check manual e gravar em system_health_log' })
  async triggerHealthCheck() {
    return this.triggerHealthCheckUc.execute();
  }

  @Roles('admin')
  @Get('admin/migration-health')
  @ApiOperation({ summary: 'Estado operacional da migração Supabase → NestJS (admin)' })
  async migrationHealth() {
    return this.healthCheckService.migrationHealth();
  }
}
