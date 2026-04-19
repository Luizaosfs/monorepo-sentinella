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
@ApiTags('Dashboard Executivo')
@Controller('dashboard/executivo')
export class ExecutivoController {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('kpis')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'KPIs estratégicos da semana (v_executivo_kpis)' })
  async kpis() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_executivo_kpis WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('tendencia')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Tendência últimas 8 semanas (v_executivo_tendencia)' })
  async tendencia() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_executivo_tendencia WHERE cliente_id = ${clienteId}::uuid ORDER BY semana_inicio`,
    );
  }

  @Get('cobertura')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Cobertura territorial por bairro (v_executivo_cobertura)' })
  async cobertura() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_executivo_cobertura WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('bairros-variacao')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Variação de focos por bairro (v_executivo_bairros_variacao)' })
  async bairrosVariacao() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_executivo_bairros_variacao WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('comparativo-ciclos')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Comparativo bimestral (v_executivo_comparativo_ciclos)' })
  async comparativoCiclos() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_executivo_comparativo_ciclos WHERE cliente_id = ${clienteId}::uuid`,
    );
  }
}
