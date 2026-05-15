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
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  BulkInsertItemsBody,
  bulkInsertItemsSchema,
  UpsertPluvioItemBody,
  upsertPluvioItemSchema,
} from './dtos/upsert-pluvio-item.body';
import {
  UpsertPluvioRiscoBody,
  upsertPluvioRiscoSchema,
} from './dtos/upsert-pluvio-risco.body';
import {
  CreatePluvioRunBody,
  createPluvioRunSchema,
} from './dtos/create-pluvio-run.body';
import {
  FilterPluvioRunInput,
  filterPluvioRunSchema,
} from './dtos/filter-pluvio-run.input';
import {
  CriarRunComItensBody,
  criarRunComItensSchema,
} from './dtos/criar-run-com-itens.body';
import { BulkInsertItems } from './use-cases/bulk-insert-items';
import { CriarRunComItens } from './use-cases/criar-run-com-itens';
import { GerarSlasRun } from './use-cases/gerar-slas-run';
import { BulkInsertRisco } from './use-cases/bulk-insert-risco';
import { CreateRun } from './use-cases/create-run';
import { DeleteItem } from './use-cases/delete-item';
import { DeleteRisco } from './use-cases/delete-risco';
import { DeleteRun } from './use-cases/delete-run';
import { FilterItems } from './use-cases/filter-items';
import { FilterRisco } from './use-cases/filter-risco';
import { FilterRuns } from './use-cases/filter-runs';
import { LatestRun } from './use-cases/latest-run';
import { UpdateRunTotal } from './use-cases/update-run-total';
import { UpsertItem } from './use-cases/upsert-item';
import { UpsertRisco } from './use-cases/upsert-risco';
import { RiscoByCliente } from './use-cases/risco-by-cliente';
import { GetStormForecast } from './use-cases/get-storm-forecast';
import { GetAlertaTerritorial } from './use-cases/get-alerta-territorial';
import {
  PluvioItemViewModel,
  PluvioRiscoViewModel,
  PluvioRunViewModel,
} from './view-model/pluvio';
import { z } from 'zod';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Pluvio')
@Controller('pluvio')
export class PluvioController {
  constructor(
    private filterRunsUC: FilterRuns,
    private createRunUC: CreateRun,
    private deleteRunUC: DeleteRun,
    private latestRunUC: LatestRun,
    private updateRunTotalUC: UpdateRunTotal,
    private filterItemsUC: FilterItems,
    private upsertItemUC: UpsertItem,
    private deleteItemUC: DeleteItem,
    private bulkInsertItemsUC: BulkInsertItems,
    private criarRunComItensUC: CriarRunComItens,
    private filterRiscoUC: FilterRisco,
    private upsertRiscoUC: UpsertRisco,
    private deleteRiscoUC: DeleteRisco,
    private bulkInsertRiscoUC: BulkInsertRisco,
    private gerarSlasRunUC: GerarSlasRun,
    private riscoByClienteUC: RiscoByCliente,
    private getStormForecastUC: GetStormForecast,
    private getAlertaTerritorialUC: GetAlertaTerritorial,
    @Inject(REQUEST) private req: Request,
  ) {}

  // ── Runs ─────────────────────────────────────────────────────────────────

  @Get('runs/latest')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Última run pluviométrica do cliente' })
  async latestRun() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const { run } = await this.latestRunUC.execute(clienteId);
    return PluvioRunViewModel.toHttp(run);
  }

  @Get('runs')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar runs pluviométricas' })
  async filterRuns(@Query() filters: FilterPluvioRunInput) {
    const parsed = filterPluvioRunSchema.parse(filters);
    const clienteId = getAccessScope(this.req).tenantId ?? undefined;
    const { runs } = await this.filterRunsUC.execute(parsed, clienteId);
    return runs.map(PluvioRunViewModel.toHttp);
  }

  @Post('runs')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar run pluviométrica' })
  async createRun(@Body() body: CreatePluvioRunBody) {
    const parsed = createPluvioRunSchema.parse(body);
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    const { run } = await this.createRunUC.execute(parsed, clienteId);
    return PluvioRunViewModel.toHttp(run);
  }

  @Post('runs/com-itens')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Cria run + itens numa única transação (porte da RPC criar_pluvio_run_com_itens)',
  })
  async criarRunComItens(@Body() body: CriarRunComItensBody) {
    const parsed = criarRunComItensSchema.parse(body);
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.criarRunComItensUC.execute(parsed, clienteId);
  }

  @Patch('runs/:id/total')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar total da run' })
  async updateRunTotal(
    @Param('id') id: string,
    @Body() body: { total: number },
  ) {
    const { total } = z.object({ total: z.number() }).parse(body);
    const { run } = await this.updateRunTotalUC.execute(id, total);
    return PluvioRunViewModel.toHttp(run);
  }

  @Post('runs/:runId/gerar-slas')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Gera SLAs operacionais para itens alto/critico do run' })
  async gerarSlas(@Param('runId') runId: string) {
    return this.gerarSlasRunUC.execute(runId);
  }

  @Delete('runs/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Deletar run pluviométrica' })
  async deleteRun(@Param('id') id: string) {
    await this.deleteRunUC.execute(id);
    return { success: true };
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  @Get('runs/:runId/items')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar itens de uma run' })
  async filterItems(@Param('runId') runId: string) {
    const { items } = await this.filterItemsUC.execute(runId);
    return items.map(PluvioItemViewModel.toHttp);
  }

  @Put('items')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar ou atualizar item pluviométrico' })
  async upsertItem(@Body() body: UpsertPluvioItemBody) {
    const parsed = upsertPluvioItemSchema.parse(body);
    const { item } = await this.upsertItemUC.execute(parsed);
    return PluvioItemViewModel.toHttp(item);
  }

  @Post('items/bulk')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Inserção em lote de itens pluviométricos' })
  async bulkInsertItems(@Body() body: BulkInsertItemsBody) {
    const { items } = bulkInsertItemsSchema.parse(body);
    return this.bulkInsertItemsUC.execute(items);
  }

  @Delete('items/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Deletar item pluviométrico' })
  async deleteItem(@Param('id') id: string) {
    await this.deleteItemUC.execute(id);
    return { success: true };
  }

  // ── Risco ─────────────────────────────────────────────────────────────────

  @Get('alerta-territorial')
  @Roles('supervisor')
  @ApiOperation({ summary: 'Alerta pluviométrico territorial — regiões em risco preventivo' })
  async alertaTerritorial() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.getAlertaTerritorialUC.execute(clienteId);
  }

  @Get('storm-forecast')
  @Roles('supervisor', 'agente')
  @ApiOperation({ summary: 'Previsão de tempestades por região do cliente (próximos 4 dias)' })
  async stormForecast() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.getStormForecastUC.execute(clienteId);
  }

  @Get('risco/by-cliente')
  @Roles('supervisor', 'agente')
  @ApiOperation({ summary: 'Risco pluviométrico de todas as regiões do cliente' })
  async riscoByCliente() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.riscoByClienteUC.execute(clienteId);
  }

  @Get('risco')
  @Roles('supervisor', 'agente')
  @ApiOperation({ summary: 'Listar riscos pluviométricos por região' })
  async filterRisco(@Query('regiaoId') regiaoIds: string | string[]) {
    const ids = Array.isArray(regiaoIds) ? regiaoIds : regiaoIds ? [regiaoIds] : [];
    const { riscos } = await this.filterRiscoUC.execute(ids);
    return riscos;
  }

  @Put('risco')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar ou atualizar risco pluviométrico' })
  async upsertRisco(@Body() body: UpsertPluvioRiscoBody) {
    const parsed = upsertPluvioRiscoSchema.parse(body);
    const { risco } = await this.upsertRiscoUC.execute(parsed);
    return PluvioRiscoViewModel.toHttp(risco);
  }

  @Post('risco/bulk')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Inserção em lote de riscos pluviométricos' })
  async bulkInsertRisco(@Body() body: { riscos: UpsertPluvioRiscoBody[] }) {
    const schema = z.object({ riscos: z.array(upsertPluvioRiscoSchema).min(1) });
    const { riscos } = schema.parse(body);
    return this.bulkInsertRiscoUC.execute(riscos);
  }

  @Delete('risco/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Deletar risco pluviométrico' })
  async deleteRisco(@Param('id') id: string) {
    await this.deleteRiscoUC.execute(id);
    return { success: true };
  }
}
