import { Controller, Get, Inject, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import { GetExecutivoKpis } from './use-cases/get-executivo-kpis';
import { GetExecutivoTendencia } from './use-cases/get-executivo-tendencia';
import { GetExecutivoCobertura } from './use-cases/get-executivo-cobertura';
import { GetExecutivoBairrosVariacao } from './use-cases/get-executivo-bairros-variacao';
import { GetExecutivoComparativoCiclos } from './use-cases/get-executivo-comparativo-ciclos';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Executivo')
@Controller('dashboard/executivo')
export class ExecutivoController {
  constructor(
    private getExecutivoKpis: GetExecutivoKpis,
    private getExecutivoTendencia: GetExecutivoTendencia,
    private getExecutivoCobertura: GetExecutivoCobertura,
    private getExecutivoBairrosVariacao: GetExecutivoBairrosVariacao,
    private getExecutivoComparativoCiclos: GetExecutivoComparativoCiclos,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('kpis')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'KPIs estratégicos da semana' })
  kpis() {
    return this.getExecutivoKpis.execute(this.req['tenantId'] as string);
  }

  @Get('tendencia')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Tendência últimas 8 semanas' })
  tendencia() {
    return this.getExecutivoTendencia.execute(this.req['tenantId'] as string);
  }

  @Get('cobertura')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Cobertura territorial por bairro' })
  cobertura() {
    return this.getExecutivoCobertura.execute(this.req['tenantId'] as string);
  }

  @Get('bairros-variacao')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Variação de focos por bairro' })
  bairrosVariacao() {
    return this.getExecutivoBairrosVariacao.execute(this.req['tenantId'] as string);
  }

  @Get('comparativo-ciclos')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Comparativo bimestral' })
  comparativoCiclos() {
    return this.getExecutivoComparativoCiclos.execute(this.req['tenantId'] as string);
  }
}
