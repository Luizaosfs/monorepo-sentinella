import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import { ListSecurityLogsInput, listSecurityLogsSchema } from './dtos/list-security-logs.input';
import { ListSecurityLogs } from './use-cases/list-security-logs';
import { SecurityLogsStats } from './use-cases/security-logs-stats';

@ApiTags('Security Logs')
@Roles('admin')
@UsePipes(MyZodValidationPipe)
@Controller('security-logs')
export class SecurityLogController {
  constructor(
    private readonly listSecurityLogs: ListSecurityLogs,
    private readonly securityLogsStats: SecurityLogsStats,
  ) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get()
  @ApiOperation({ summary: 'Listar eventos de segurança (admin)' })
  async list(@Query() query: ListSecurityLogsInput) {
    const parsed = listSecurityLogsSchema.parse(query);
    return this.listSecurityLogs.execute(parsed);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de segurança agregadas (admin)' })
  async stats(@Query('days') days?: string) {
    const parsedDays = days ? Math.min(Math.max(parseInt(days, 10) || 30, 1), 90) : 30;
    return this.securityLogsStats.execute(parsedDays);
  }
}
