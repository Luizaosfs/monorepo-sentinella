import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { Public, Roles } from '@/decorators/roles.decorator';
import { HealthCheckService } from './health-check.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness / readiness check (público, sem autenticação)' })
  async health(@Res() res: Response) {
    const result = await this.healthCheckService.check();
    res.status(result.status === 'ok' ? 200 : 503).json(result);
  }

  @Roles('admin')
  @Get('admin/migration-health')
  @ApiOperation({ summary: 'Estado operacional da migração Supabase → NestJS (admin)' })
  async migrationHealth() {
    return this.healthCheckService.migrationHealth();
  }
}
