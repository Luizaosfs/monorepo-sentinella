import { Controller, Get, Inject, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import { GetAnaliticoResumo } from './use-cases/get-analitico-resumo';
import { GetAnaliticoRiscoTerritorial } from './use-cases/get-analitico-risco-territorial';
import { GetAnaliticoVulnerabilidade } from './use-cases/get-analitico-vulnerabilidade';
import { GetAnaliticoAlertaSaude } from './use-cases/get-analitico-alerta-saude';
import { GetAnaliticoResultadoOperacional } from './use-cases/get-analitico-resultado-operacional';
import { GetAnaliticoImoveisCriticos } from './use-cases/get-analitico-imoveis-criticos';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Analítico')
@Controller('dashboard/analitico')
export class AnaliticoController {
  constructor(
    private getAnaliticoResumo: GetAnaliticoResumo,
    private getAnaliticoRiscoTerritorial: GetAnaliticoRiscoTerritorial,
    private getAnaliticoVulnerabilidade: GetAnaliticoVulnerabilidade,
    private getAnaliticoAlertaSaude: GetAnaliticoAlertaSaude,
    private getAnaliticoResultadoOperacional: GetAnaliticoResultadoOperacional,
    private getAnaliticoImoveisCriticos: GetAnaliticoImoveisCriticos,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('resumo')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'KPIs macro de vistoria' })
  resumo() {
    return this.getAnaliticoResumo.execute(this.req['tenantId'] as string);
  }

  @Get('risco-territorial')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Risco por bairro' })
  riscoTerritorial() {
    return this.getAnaliticoRiscoTerritorial.execute(this.req['tenantId'] as string);
  }

  @Get('vulnerabilidade')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Vulnerabilidade domiciliar por bairro' })
  vulnerabilidade() {
    return this.getAnaliticoVulnerabilidade.execute(this.req['tenantId'] as string);
  }

  @Get('alerta-saude')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Distribuição de alerta de saúde' })
  alertaSaude() {
    return this.getAnaliticoAlertaSaude.execute(this.req['tenantId'] as string);
  }

  @Get('resultado-operacional')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Resultado operacional por bairro' })
  resultadoOperacional() {
    return this.getAnaliticoResultadoOperacional.execute(this.req['tenantId'] as string);
  }

  @Get('imoveis-criticos')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Imóveis P1/P2 críticos' })
  imoveisCriticos() {
    return this.getAnaliticoImoveisCriticos.execute(this.req['tenantId'] as string);
  }
}
