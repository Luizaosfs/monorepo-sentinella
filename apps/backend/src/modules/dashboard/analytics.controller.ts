import { Controller, Get, Inject, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Analytics')
@Controller('analytics/regional')
export class AnalyticsController {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('kpi')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'KPI agregado por município (v_regional_kpi_municipio)' })
  async kpi() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_regional_kpi_municipio WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('sla')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'SLA por município (v_regional_sla_municipio)' })
  async sla() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_regional_sla_municipio WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('uso')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Uso do sistema por município (v_regional_uso_sistema)' })
  async uso() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_regional_uso_sistema WHERE cliente_id = ${clienteId}::uuid`,
    );
  }
}
