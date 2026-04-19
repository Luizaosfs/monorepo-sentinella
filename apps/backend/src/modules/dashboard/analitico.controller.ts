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
@ApiTags('Dashboard Analítico')
@Controller('dashboard/analitico')
export class AnaliticoController {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('resumo')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'KPIs macro de vistoria (v_dashboard_analitico_resumo)' })
  async resumo() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_dashboard_analitico_resumo WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('risco-territorial')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Risco por bairro (v_dashboard_analitico_risco_territorial)' })
  async riscoTerritorial() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_dashboard_analitico_risco_territorial WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('vulnerabilidade')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Vulnerabilidade domiciliar por bairro (v_dashboard_analitico_vulnerabilidade)' })
  async vulnerabilidade() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_dashboard_analitico_vulnerabilidade WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('alerta-saude')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Distribuição de alerta de saúde (v_dashboard_analitico_alerta_saude)' })
  async alertaSaude() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_dashboard_analitico_alerta_saude WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('resultado-operacional')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Resultado operacional por bairro (v_dashboard_analitico_resultado_operacional)' })
  async resultadoOperacional() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_dashboard_analitico_resultado_operacional WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('imoveis-criticos')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Imóveis P1/P2 críticos (v_dashboard_analitico_imoveis_criticos)' })
  async imoveisCriticos() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_dashboard_analitico_imoveis_criticos WHERE cliente_id = ${clienteId}::uuid`,
    );
  }
}
