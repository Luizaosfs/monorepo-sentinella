import { Controller, Get, Inject, Res, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request, Response } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import {
  getAccessScope,
  getClienteIdsPermitidos,
} from '@/shared/security/access-scope.helpers';
import { GetRegionalKpi } from './use-cases/get-regional-kpi';
import { GetRegionalRelatorioCSV } from './use-cases/get-regional-relatorio-csv';
import { GetRegionalResumo } from './use-cases/get-regional-resumo';
import { GetRegionalSla } from './use-cases/get-regional-sla';
import { GetRegionalUso } from './use-cases/get-regional-uso';
import { GetRegionalVulnerabilidade } from './use-cases/get-regional-vulnerabilidade';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Analytics')
@Controller('analytics/regional')
export class AnalyticsController {
  constructor(
    private getRegionalKpi: GetRegionalKpi,
    private getRegionalResumo: GetRegionalResumo,
    private getRegionalSla: GetRegionalSla,
    private getRegionalUso: GetRegionalUso,
    private getRegionalVulnerabilidade: GetRegionalVulnerabilidade,
    private getRegionalRelatorioCSV: GetRegionalRelatorioCSV,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('kpi')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'KPI agregado por município' })
  kpi() {
    const scope = getAccessScope(this.req);
    return this.getRegionalKpi.execute(getClienteIdsPermitidos(scope));
  }

  @Get('sla')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'SLA por município' })
  sla() {
    const scope = getAccessScope(this.req);
    return this.getRegionalSla.execute(getClienteIdsPermitidos(scope));
  }

  @Get('uso')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Uso do sistema por município' })
  uso() {
    const scope = getAccessScope(this.req);
    return this.getRegionalUso.execute(getClienteIdsPermitidos(scope));
  }

  @Get('resumo')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Resumo consolidado por município — vistorias, vulnerabilidade, risco vetorial, prioridade' })
  resumo() {
    const scope = getAccessScope(this.req);
    return this.getRegionalResumo.execute(getClienteIdsPermitidos(scope));
  }

  @Get('vulnerabilidade')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Vulnerabilidade por município — domiciliar, risco vetorial, alerta saúde, prioridade' })
  vulnerabilidade() {
    const scope = getAccessScope(this.req);
    return this.getRegionalVulnerabilidade.execute(getClienteIdsPermitidos(scope));
  }

  @Get('relatorio.csv')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Exportar relatório consolidado por município (CSV)' })
  async relatorioCsv(@Res() res: Response) {
    const scope = getAccessScope(this.req);
    const csv = await this.getRegionalRelatorioCSV.execute(getClienteIdsPermitidos(scope));
    const filename = `relatorio-regional-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('comparativo-municipios')
  @Roles('admin')
  @ApiOperation({ summary: 'Comparativo KPIs entre todos os municípios' })
  comparativoMunicipios() {
    return this.getRegionalKpi.executeAll();
  }
}
