import { BadRequestException, Controller, Get, Inject, Param, Query, Res, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request, Response } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import {
  getAccessScope,
  getClienteIdsPermitidos,
  requireClientePermitido,
} from '@/shared/security/access-scope.helpers';
import { GetRegionalComparativo, ComparativoParams } from './use-cases/get-regional-comparativo';
import { GetRegionalMunicipioDetalhe } from './use-cases/get-regional-municipio-detalhe';
import { GetRegionalEvolucao, EvolucaoParams } from './use-cases/get-regional-evolucao';
import { GetRegionalKpi } from './use-cases/get-regional-kpi';
import { GetRegionalRelatorioCSV } from './use-cases/get-regional-relatorio-csv';
import { GetRegionalRelatorioPDF } from './use-cases/get-regional-relatorio-pdf';
import { GetRegionalResumo } from './use-cases/get-regional-resumo';
import { GetRegionalSla } from './use-cases/get-regional-sla';
import { GetRegionalUso } from './use-cases/get-regional-uso';
import { GetRegionalVulnerabilidade } from './use-cases/get-regional-vulnerabilidade';

const MAX_INTERVAL_MS     = 730 * 24 * 60 * 60 * 1000 // ~24 meses (evolucao)
const MAX_COMPARATIVO_MS  = 365 * 24 * 60 * 60 * 1000 // 365 dias  (comparativo)

function parseEvolucaoParams(dataInicioRaw?: string, dataFimRaw?: string): EvolucaoParams {
  const now = new Date()
  const fim = dataFimRaw ? new Date(dataFimRaw) : now

  const d12mAgo = new Date(now)
  d12mAgo.setMonth(d12mAgo.getMonth() - 12)
  d12mAgo.setDate(1)
  d12mAgo.setHours(0, 0, 0, 0)
  const inicio = dataInicioRaw ? new Date(dataInicioRaw) : d12mAgo

  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
    throw new BadRequestException('dataInicio e dataFim devem estar no formato YYYY-MM-DD')
  }
  if (fim <= inicio) {
    throw new BadRequestException('dataFim deve ser posterior a dataInicio')
  }
  if (fim.getTime() - inicio.getTime() > MAX_INTERVAL_MS) {
    throw new BadRequestException('Intervalo máximo permitido é 24 meses')
  }
  return { dataInicio: inicio, dataFim: fim }
}

function parseComparativoParams(dataInicioRaw?: string, dataFimRaw?: string): ComparativoParams {
  const now = new Date()
  const fim = dataFimRaw ? new Date(dataFimRaw) : now

  const d30dAgo = new Date(now)
  d30dAgo.setDate(d30dAgo.getDate() - 30)
  d30dAgo.setHours(0, 0, 0, 0)
  const inicio = dataInicioRaw ? new Date(dataInicioRaw) : d30dAgo

  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
    throw new BadRequestException('dataInicio e dataFim devem estar no formato YYYY-MM-DD')
  }
  if (fim <= inicio) {
    throw new BadRequestException('dataFim deve ser posterior a dataInicio')
  }
  const duracao = fim.getTime() - inicio.getTime()
  if (duracao > MAX_COMPARATIVO_MS) {
    throw new BadRequestException('Intervalo máximo permitido é 365 dias')
  }
  return {
    dataInicio: inicio,
    dataFim: fim,
    anteriorInicio: new Date(inicio.getTime() - duracao),
    anteriorFim: inicio,
  }
}

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
    private getRegionalComparativo: GetRegionalComparativo,
    private getRegionalEvolucao: GetRegionalEvolucao,
    private getRegionalRelatorioPDF: GetRegionalRelatorioPDF,
    private getRegionalMunicipioDetalhe: GetRegionalMunicipioDetalhe,
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

  @Get('comparativo')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Comparativo de indicadores entre período atual e período anterior de mesma duração' })
  comparativo(
    @Query('dataInicio') dataInicioRaw?: string,
    @Query('dataFim') dataFimRaw?: string,
  ) {
    const scope = getAccessScope(this.req);
    return this.getRegionalComparativo.execute(
      getClienteIdsPermitidos(scope),
      parseComparativoParams(dataInicioRaw, dataFimRaw),
    );
  }

  @Get('evolucao')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Evolução temporal mensal — focos e vistorias agrupados por mês' })
  evolucao(
    @Query('dataInicio') dataInicioRaw?: string,
    @Query('dataFim') dataFimRaw?: string,
  ) {
    const scope = getAccessScope(this.req);
    return this.getRegionalEvolucao.execute(
      getClienteIdsPermitidos(scope),
      parseEvolucaoParams(dataInicioRaw, dataFimRaw),
    );
  }

  @Get('relatorio.pdf')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Exportar relatório executivo regional (PDF)' })
  async relatorioPdf(@Res() res: Response) {
    const scope = getAccessScope(this.req);
    const buffer = await this.getRegionalRelatorioPDF.execute(getClienteIdsPermitidos(scope));
    const filename = `relatorio-regional-sentinella-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('municipio/:clienteId')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Detalhe analítico de um município — drill-down por clienteId' })
  municipioDetalhe(@Param('clienteId') clienteId: string) {
    const scope = getAccessScope(this.req);
    requireClientePermitido(scope, clienteId);
    return this.getRegionalMunicipioDetalhe.execute(clienteId);
  }

  @Get('comparativo-municipios')
  @Roles('admin')
  @ApiOperation({ summary: 'Comparativo KPIs entre todos os municípios' })
  comparativoMunicipios() {
    return this.getRegionalKpi.executeAll();
  }
}
