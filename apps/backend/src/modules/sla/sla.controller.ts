import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  PaginationProps,
  paginationSchema,
} from '@shared/dtos/pagination-body';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  AtribuirOperadorBody,
  atribuirOperadorSchema,
} from './dtos/atribuir-operador.body';
import {
  CreateFeriadoBody,
  createFeriadoSchema,
} from './dtos/create-feriado.body';
import { EscalarSlaBody, escalarSlaSchema } from './dtos/escalar-sla.body';
import { FilterSlaQuery, filterSlaSchema } from './dtos/filter-sla.input';
import { SaveConfigBody, saveConfigSchema } from './dtos/save-config.body';
import {
  SaveFocoConfigBody,
  saveFocoConfigSchema,
} from './dtos/save-foco-config.body';
import {
  UpdateSlaStatusBody,
  updateSlaStatusSchema,
} from './dtos/update-sla-status.body';
import { AtribuirOperador } from './use-cases/atribuir-operador';
import { ConcluirSla } from './use-cases/concluir-sla';
import { CountPendentes } from './use-cases/count-pendentes';
import { CreateFeriado } from './use-cases/create-feriado';
import { DeleteFeriado } from './use-cases/delete-feriado';
import { EscalarSla } from './use-cases/escalar-sla';
import { GetConfig } from './use-cases/get-config';
import { GetFocoConfig } from './use-cases/get-foco-config';
import { ListConfigRegioes } from './use-cases/list-config-regioes';
import { ListErrosCriacao } from './use-cases/list-erros-criacao';
import { ListFeriados } from './use-cases/list-feriados';
import { ListSla } from './use-cases/list-sla';
import { ListSlaPainel } from './use-cases/list-sla-painel';
import { ListSlaIminentes } from './use-cases/list-sla-iminentes';
import { PaginationSla } from './use-cases/pagination-sla';
import { ReabrirSla } from './use-cases/reabrir-sla';
import { SaveConfig } from './use-cases/save-config';
import { SaveFocoConfig } from './use-cases/save-foco-config';
import { UpdateSlaStatus } from './use-cases/update-sla-status';
import { UpsertConfigRegiao } from './use-cases/upsert-config-regiao';
import {
  SlaConfigViewModel,
  SlaFeriadoViewModel,
  SlaFocoConfigViewModel,
} from './view-model/sla-config';
import { SlaOperacionalViewModel } from './view-model/sla-operacional';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('SLA')
@Controller('sla')
export class SlaController {
  constructor(
    private listSla: ListSla,
    private paginationSla: PaginationSla,
    private listSlaPainel: ListSlaPainel,
    private listSlaIminentes: ListSlaIminentes,
    private countPendentes: CountPendentes,
    private updateSlaStatus: UpdateSlaStatus,
    private escalarSla: EscalarSla,
    private reabrirSla: ReabrirSla,
    private concluirSla: ConcluirSla,
    private atribuirOperador: AtribuirOperador,
    private getConfig: GetConfig,
    private saveConfig: SaveConfig,
    private listFeriados: ListFeriados,
    private createFeriado: CreateFeriado,
    private deleteFeriado: DeleteFeriado,
    private getFocoConfig: GetFocoConfig,
    private saveFocoConfig: SaveFocoConfig,
    private listConfigRegioes: ListConfigRegioes,
    private upsertConfigRegiao: UpsertConfigRegiao,
    private listErrosCriacao: ListErrosCriacao,
    @Inject(REQUEST) private req: Request,
  ) {}

  // ── Operacional ──────────────────────────────────────────────────────────

  @Get('iminentes')
  @Roles('admin', 'supervisor', 'agente', 'analista_regional')
  @ApiOperation({ summary: 'SLAs nos últimos 20% do prazo (iminentes)' })
  async iminentes() {
    const clienteId = this.req['tenantId'] as string;
    const { iminentes } = await this.listSlaIminentes.execute(clienteId);
    return iminentes;
  }

  @Get()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar SLAs do cliente' })
  async filter(@Query() filters: FilterSlaQuery) {
    const parsed = filterSlaSchema.parse(filters);
    const { slas } = await this.listSla.execute(parsed);
    return slas.map(SlaOperacionalViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'SLAs paginados' })
  async pagination(
    @Query() filters: FilterSlaQuery,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterSlaSchema.parse(filters);
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationSla.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(SlaOperacionalViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get('painel')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'SLAs para painel operacional' })
  async painel(@Query('operadorId') operadorId?: string) {
    const { slas } = await this.listSlaPainel.execute(operadorId);
    return slas.map(SlaOperacionalViewModel.toHttp);
  }

  @Get('pendentes/count')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Contagem de SLAs pendentes + em atendimento' })
  async countPendentesRoute() {
    return this.countPendentes.execute();
  }

  @Patch(':id/status')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar status do SLA' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateSlaStatusBody,
  ) {
    const parsed = updateSlaStatusSchema.parse(body);
    const { sla } = await this.updateSlaStatus.execute(id, parsed, this.req['tenantId'] as string | null);
    return SlaOperacionalViewModel.toHttp(sla);
  }

  @Post(':id/escalar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Escalar prioridade do SLA' })
  async escalar(@Param('id') id: string, @Body() body: EscalarSlaBody) {
    escalarSlaSchema.parse(body);
    return this.escalarSla.execute(id);
  }

  @Post(':id/reabrir')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Reabrir SLA concluído' })
  async reabrir(@Param('id') id: string) {
    const { sla } = await this.reabrirSla.execute(id, this.req['tenantId'] as string | null);
    return SlaOperacionalViewModel.toHttp(sla);
  }

  @Post(':id/concluir')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Concluir SLA manualmente' })
  async concluir(@Param('id') id: string) {
    const { sla } = await this.concluirSla.execute(id, this.req['tenantId'] as string | null);
    return SlaOperacionalViewModel.toHttp(sla);
  }

  @Patch(':id/atribuir')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atribuir operador ao SLA' })
  async atribuir(@Param('id') id: string, @Body() body: AtribuirOperadorBody) {
    const parsed = atribuirOperadorSchema.parse(body);
    const { sla } = await this.atribuirOperador.execute(id, parsed, this.req['tenantId'] as string | null);
    return SlaOperacionalViewModel.toHttp(sla);
  }

  // ── Configuração ─────────────────────────────────────────────────────────

  @Get('config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Buscar configuração SLA do cliente' })
  async getConfigRoute() {
    const { config } = await this.getConfig.execute();
    return config && 'id' in config
      ? SlaConfigViewModel.toHttp(config as any)
      : config;
  }

  @Put('config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Salvar configuração SLA (gera auditoria)' })
  async saveConfigRoute(@Body() body: SaveConfigBody) {
    const parsed = saveConfigSchema.parse(body);
    const { config } = await this.saveConfig.execute(parsed);
    return SlaConfigViewModel.toHttp(config);
  }

  @Get('config/regioes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar configuração SLA por região' })
  async listConfigRegioesRoute() {
    const { configs } = await this.listConfigRegioes.execute();
    return configs;
  }

  @Put('config/regioes/:regiaoId')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Upsert configuração SLA por região' })
  async upsertConfigRegiaoRoute(
    @Param('regiaoId') regiaoId: string,
    @Body() body: SaveConfigBody,
  ) {
    const parsed = saveConfigSchema.parse(body);
    return this.upsertConfigRegiao.execute(regiaoId, parsed);
  }

  @Get('feriados')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar feriados do cliente' })
  async listFeriadosRoute() {
    const { feriados } = await this.listFeriados.execute();
    return feriados.map(SlaFeriadoViewModel.toHttp);
  }

  @Post('feriados')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar feriado' })
  async createFeriadoRoute(@Body() body: CreateFeriadoBody) {
    const parsed = createFeriadoSchema.parse(body);
    const { feriado } = await this.createFeriado.execute(parsed);
    return SlaFeriadoViewModel.toHttp(feriado);
  }

  @Delete('feriados/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover feriado' })
  async deleteFeriadoRoute(@Param('id') id: string) {
    return this.deleteFeriado.execute(id);
  }

  @Get('foco-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar prazos SLA por fase do foco' })
  async getFocoConfigRoute() {
    const { configs } = await this.getFocoConfig.execute();
    return configs.map(SlaFocoConfigViewModel.toHttp);
  }

  @Put('foco-config')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar prazos SLA por fase' })
  async saveFocoConfigRoute(@Body() body: SaveFocoConfigBody) {
    const parsed = saveFocoConfigSchema.parse(body);
    const { configs } = await this.saveFocoConfig.execute(parsed);
    return configs.map(SlaFocoConfigViewModel.toHttp);
  }

  @Get('erros')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar erros de criação de SLA (últimos 20)' })
  async listErrosRoute() {
    const { erros } = await this.listErrosCriacao.execute();
    return erros;
  }
}
