import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { Public } from '@/decorators/roles.decorator';
import { HealthCheckService } from './health-check.service';

/**
 * Endpoint público de liveness/readiness.
 * Sem guards — acessível por load balancer, uptime monitors e pipelines de CI.
 */
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
}
