import { Controller, Get, Inject, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import { GetAnaliticoBairros } from './use-cases/get-analitico-bairros';
import { GetAnaliticoResumo } from './use-cases/get-analitico-resumo';
import { GetAnaliticoRiscoTerritorial } from './use-cases/get-analitico-risco-territorial';
import { GetAnaliticoVulnerabilidade } from './use-cases/get-analitico-vulnerabilidade';
import { GetAnaliticoAlertaSaude } from './use-cases/get-analitico-alerta-saude';
import { GetAnaliticoResultadoOperacional } from './use-cases/get-analitico-resultado-operacional';
import { GetAnaliticoImoveisCriticos } from './use-cases/get-analitico-imoveis-criticos';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Analítico')
@Controller('dashboard/analitico')
export class AnaliticoController {
  constructor(
    private getAnaliticoBairros: GetAnaliticoBairros,
    private getAnaliticoResumo: GetAnaliticoResumo,
    private getAnaliticoRiscoTerritorial: GetAnaliticoRiscoTerritorial,
    private getAnaliticoVulnerabilidade: GetAnaliticoVulnerabilidade,
    private getAnaliticoAlertaSaude: GetAnaliticoAlertaSaude,
    private getAnaliticoResultadoOperacional: GetAnaliticoResultadoOperacional,
    private getAnaliticoImoveisCriticos: GetAnaliticoImoveisCriticos,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('bairros')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Lista de bairros com vistorias registradas' })
  bairros() {
    return this.getAnaliticoBairros.execute(this.req['tenantId'] as string);
  }

  @Get('resumo')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'KPIs macro de vistoria' })
  resumo() {
    return this.getAnaliticoResumo.execute(this.req['tenantId'] as string);
  }

  @Get('risco-territorial')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Risco por bairro' })
  riscoTerritorial() {
    return this.getAnaliticoRiscoTerritorial.execute(this.req['tenantId'] as string);
  }

  @Get('vulnerabilidade')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Vulnerabilidade domiciliar por bairro' })
  vulnerabilidade() {
    return this.getAnaliticoVulnerabilidade.execute(this.req['tenantId'] as string);
  }

  @Get('alerta-saude')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Distribuição de alerta de saúde' })
  alertaSaude() {
    return this.getAnaliticoAlertaSaude.execute(this.req['tenantId'] as string);
  }

  @Get('resultado-operacional')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Resultado operacional por bairro' })
  resultadoOperacional() {
    return this.getAnaliticoResultadoOperacional.execute(this.req['tenantId'] as string);
  }

  @Get('imoveis-criticos')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Imóveis P1/P2 críticos' })
  imoveisCriticos() {
    return this.getAnaliticoImoveisCriticos.execute(this.req['tenantId'] as string);
  }
}
