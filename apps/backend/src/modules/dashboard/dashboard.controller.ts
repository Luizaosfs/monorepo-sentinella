import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateRelatorioBody,
  createRelatorioSchema,
} from './dtos/create-relatorio.body';
import { CalcularLiraa } from './use-cases/calcular-liraa';
import { GetCentralKpis } from './use-cases/get-central-kpis';
import { ListImoveisParaHoje } from './use-cases/list-imoveis-para-hoje';
import { ComparativoAgentes } from './use-cases/comparativo-agentes';
import { ConsumoLarvicida } from './use-cases/consumo-larvicida';
import { CreateRelatorio } from './use-cases/create-relatorio';
import { FilterAlerts } from './use-cases/filter-alerts';
import { FilterHealth } from './use-cases/filter-health';
import { FilterRelatorios } from './use-cases/filter-relatorios';
import { FilterResumos } from './use-cases/filter-resumos';
import { GerarRelatorioAnalitico } from './use-cases/gerar-relatorio-analitico';
import { ResolverAlert } from './use-cases/resolver-alert';
import { ResumoAgente } from './use-cases/resumo-agente';
import { ResumoRegional } from './use-cases/resumo-regional';
import { ScoreSurtoRegioes } from './use-cases/score-surto-regioes';
import { DashboardViewModel } from './view-model/dashboard';
import { DashboardReadRepository } from './repositories/dashboard-read.repository';
import {
  ComparativoAgentesQuery,
  comparativoAgentesQuerySchema,
  ConsumoLarvicidaQuery,
  consumoLarvicidaQuerySchema,
  LiraaQuery,
  liraaQuerySchema,
  RelatorioAnaliticoBody,
  relatorioAnaliticoBodySchema,
  ResumoAgenteQuery,
  resumoAgenteQuerySchema,
  ResumoRegionalQuery,
  resumoRegionalQuerySchema,
  ScoreSurtoQuery,
  scoreSurtoQuerySchema,
} from './dtos/dashboard-analytics.input';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private resumosFilter: FilterResumos,
    private relatoriosFilter: FilterRelatorios,
    private relatorioCreate: CreateRelatorio,
    private healthFilter: FilterHealth,
    private alertsFilter: FilterAlerts,
    private alertResolve: ResolverAlert,
    private getCentralKpisUc: GetCentralKpis,
    private listImoveisParaHojeUc: ListImoveisParaHoje,
    private calcularLiraaUc: CalcularLiraa,
    private comparativoAgentesUc: ComparativoAgentes,
    private consumoLarvicidaUc: ConsumoLarvicida,
    private resumoRegionalUc: ResumoRegional,
    private scoreSurtoRegioesUc: ScoreSurtoRegioes,
    private resumoAgenteUc: ResumoAgente,
    private gerarRelatorioAnaliticoUc: GerarRelatorioAnalitico,
    private dashboardRead: DashboardReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  // ── Central Operacional ────────────────────────────────────────────────────

  @Get('central-kpis')
  @Roles('admin', 'supervisor', 'agente', 'analista_regional')
  @ApiOperation({ summary: 'KPIs da central operacional (substitui v_central_operacional)' })
  async centralKpis() {
    const clienteId = this.req['tenantId'] as string;
    const { kpis } = await this.getCentralKpisUc.execute(clienteId);
    return kpis;
  }

  @Get('imoveis-para-hoje')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Imóveis prioritários para vistoria hoje (substitui v_imoveis_para_hoje)' })
  async imoveisParaHoje(@Query('limit') limit?: string) {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.listImoveisParaHojeUc.execute(
      clienteId,
      limit ? parseInt(limit, 10) : 30,
    );
    return items;
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('liraa')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Calcula LIRAa (IIP e IBP) do ciclo' })
  async liraa(@Query() query: LiraaQuery) {
    const parsed = liraaQuerySchema.parse(query);
    return this.calcularLiraaUc.execute(parsed);
  }

  @Get('comparativo-agentes')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Tabela comparativa de desempenho dos agentes' })
  async comparativoAgentes(@Query() query: ComparativoAgentesQuery) {
    const parsed = comparativoAgentesQuerySchema.parse(query);
    return this.comparativoAgentesUc.execute(parsed);
  }

  @Get('consumo-larvicida')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Consumo de larvicida por agente e tipo de depósito' })
  async consumoLarvicida(@Query() query: ConsumoLarvicidaQuery) {
    const parsed = consumoLarvicidaQuerySchema.parse(query);
    return this.consumoLarvicidaUc.execute(parsed);
  }

  @Get('resumo-regional')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Resumo de métricas agregadas por região' })
  async resumoRegional(@Query() query: ResumoRegionalQuery) {
    const parsed = resumoRegionalQuerySchema.parse(query);
    return this.resumoRegionalUc.execute(parsed);
  }

  @Get('score-surto')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Score de risco de surto por região (pluvio + focos)' })
  async scoreSurto(@Query() query: ScoreSurtoQuery) {
    const parsed = scoreSurtoQuerySchema.parse(query);
    return this.scoreSurtoRegioesUc.execute(parsed);
  }

  @Get('resumo-agente')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Resumo de um agente no ciclo' })
  async resumoAgente(@Query() query: ResumoAgenteQuery) {
    const parsed = resumoAgenteQuerySchema.parse(query);
    return this.resumoAgenteUc.execute(parsed);
  }

  @Post('relatorio-analitico')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Gera relatório analítico completo do período e salva' })
  async relatorioAnalitico(@Body() body: RelatorioAnaliticoBody) {
    const parsed = relatorioAnaliticoBodySchema.parse(body);
    const { relatorio } = await this.gerarRelatorioAnaliticoUc.execute(parsed);
    return DashboardViewModel.relatorioToHttp(relatorio);
  }

  // ── Resumos / Relatórios ───────────────────────────────────────────────────

  @Get('resumos')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Listar resumos diários' })
  async listResumos(@Query('limit') limit?: string) {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.resumosFilter.execute(
      clienteId,
      limit ? parseInt(limit) : 30,
    );
    return items.map(DashboardViewModel.toHttp);
  }

  @Get('relatorios')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Listar relatórios gerados' })
  async listRelatorios() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.relatoriosFilter.execute(clienteId);
    return items.map(DashboardViewModel.relatorioToHttp);
  }

  @Post('relatorios')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Gerar relatório' })
  async createRelatorio(@Body() body: CreateRelatorioBody) {
    const parsed = createRelatorioSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = this.req['userId'] as string | undefined;
    const { relatorio } = await this.relatorioCreate.execute(clienteId, userId, parsed);
    return DashboardViewModel.relatorioToHttp(relatorio);
  }

  @Get('health')
  @Roles('admin')
  @ApiOperation({ summary: 'Listar logs de saúde do sistema' })
  async listHealth(@Query('limit') limit?: string) {
    const { items } = await this.healthFilter.execute(limit ? parseInt(limit) : 50);
    return items.map(DashboardViewModel.healthToHttp);
  }

  @Get('alerts')
  @Roles('admin')
  @ApiOperation({ summary: 'Listar alertas do sistema' })
  async listAlerts(@Query('resolvido') resolvido?: string) {
    const resolvidoFilter =
      resolvido === 'true' ? true : resolvido === 'false' ? false : undefined;
    const { items } = await this.alertsFilter.execute(resolvidoFilter);
    return items.map(DashboardViewModel.alertToHttp);
  }

  @Put('alerts/:id/resolver')
  @Roles('admin')
  @ApiOperation({ summary: 'Resolver alerta do sistema' })
  async resolverAlert(@Param('id') id: string) {
    await this.alertResolve.execute(id);
    return { resolved: true };
  }

  // ── LIRAa extras ──────────────────────────────────────────────────────────

  @Get('ciclos-disponiveis')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Listar ciclos disponíveis do cliente' })
  async ciclosDisponiveis() {
    const clienteId = this.req['tenantId'] as string;
    return this.dashboardRead.listCiclosDisponiveis(clienteId);
  }

  @Get('liraa/export')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Dados LIRAa estruturados para exportação (substitui exportarPdf)' })
  async liraaExportData(@Query() query: LiraaQuery) {
    const parsed = liraaQuerySchema.parse(query);
    const clienteId = this.req['tenantId'] as string;
    const result = await this.dashboardRead.calcularLiraa(clienteId, parsed.ciclo);
    return result;
  }

  @Get('liraa/quarteirao')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'LIRAa (IIP/IBP) agregado por quarteirão (substitui v_liraa_quarteirao)' })
  async liraaByQuarteirao(@Query() query: LiraaQuery) {
    const parsed = liraaQuerySchema.parse(query);
    const clienteId = this.req['tenantId'] as string;
    return this.dashboardRead.listLiraaByQuarteirao(clienteId, parsed.ciclo);
  }
}
