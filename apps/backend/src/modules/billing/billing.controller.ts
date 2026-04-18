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
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateCicloBody,
  CreateClientePlanoBody,
  CreatePlanoBody,
  createCicloSchema,
  createClientePlanoSchema,
  createPlanoSchema,
  SavePlanoBody,
  savePlanoSchema,
  UpsertQuotasBody,
  upsertQuotasSchema,
} from './dtos/create-billing.body';
import { CreateCiclo } from './use-cases/create-ciclo';
import { CreateClientePlano } from './use-cases/create-cliente-plano';
import { CreatePlano } from './use-cases/create-plano';
import { FilterCiclos } from './use-cases/filter-ciclos';
import { FilterPlanos } from './use-cases/filter-planos';
import { GetClientePlano } from './use-cases/get-cliente-plano';
import { GetQuotas } from './use-cases/get-quotas';
import { SavePlano } from './use-cases/save-plano';
import { UpsertQuotas } from './use-cases/upsert-quotas';
import { MeuUsoMensal } from './use-cases/meu-uso-mensal';
import { UsoMensalTodos } from './use-cases/uso-mensal-todos';
import { VerificarQuota } from './use-cases/verificar-quota';
import {
  VerificarQuotaQuery,
  verificarQuotaSchema,
} from './dtos/verificar-quota.input';
import { BillingViewModel } from './view-model/billing';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private planoFilter: FilterPlanos,
    private planoCreate: CreatePlano,
    private planoSave: SavePlano,
    private clientePlanoGet: GetClientePlano,
    private clientePlanoCreate: CreateClientePlano,
    private cicloFilter: FilterCiclos,
    private cicloCreate: CreateCiclo,
    private quotasGet: GetQuotas,
    private quotasUpsert: UpsertQuotas,
    private meuUsoMensal: MeuUsoMensal,
    private usoMensalTodos: UsoMensalTodos,
    private verificarQuota: VerificarQuota,
    @Inject(REQUEST) private req: Request,
  ) {}

  // ── Uso mensal ───────────────────────────────────────────────────────────

  @Get('uso-mensal')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary: 'Uso do mês corrente do cliente logado vs limites de quotas',
  })
  async getMeuUsoMensal() {
    return this.meuUsoMensal.execute();
  }

  @Get('uso-mensal/todos')
  @Roles('admin')
  @ApiOperation({ summary: 'Uso do mês corrente de todos os clientes (admin)' })
  async getUsoMensalTodos() {
    return this.usoMensalTodos.execute();
  }

  @Get('verificar-quota')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary:
      'Verifica se uma métrica específica está dentro do limite — { ok, usado, limite }',
  })
  async getVerificarQuota(@Query() query: VerificarQuotaQuery) {
    const parsed = verificarQuotaSchema.parse(query);
    return this.verificarQuota.execute(parsed);
  }

  // ── Planos ────────────────────────────────────────────────────────────────

  @Get('planos')
  @Roles('admin')
  @ApiOperation({ summary: 'Listar planos' })
  async listPlanos() {
    const { items } = await this.planoFilter.execute();
    return items.map(BillingViewModel.toHttp);
  }

  @Post('planos')
  @Roles('admin')
  @ApiOperation({ summary: 'Criar plano' })
  async createPlano(@Body() body: CreatePlanoBody) {
    const parsed = createPlanoSchema.parse(body);
    const { plano } = await this.planoCreate.execute(parsed);
    return BillingViewModel.toHttp(plano);
  }

  @Put('planos/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Atualizar plano' })
  async savePlano(@Param('id') id: string, @Body() body: SavePlanoBody) {
    const parsed = savePlanoSchema.parse(body);
    const { plano } = await this.planoSave.execute(id, parsed);
    return BillingViewModel.toHttp(plano);
  }

  // ── Cliente Plano ────────────────────────────────────────────────────────

  @Get('cliente-plano')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Obter plano do cliente atual' })
  async getClientePlano() {
    const clienteId = this.req['tenantId'] as string;
    const { clientePlano } = await this.clientePlanoGet.execute(clienteId);
    return BillingViewModel.clientePlanoToHttp(clientePlano);
  }

  @Post('cliente-plano')
  @Roles('admin')
  @ApiOperation({ summary: 'Associar plano a cliente' })
  async createClientePlano(@Body() body: CreateClientePlanoBody) {
    const parsed = createClientePlanoSchema.parse(body);
    const { clientePlano } = await this.clientePlanoCreate.execute(parsed);
    return BillingViewModel.clientePlanoToHttp(clientePlano);
  }

  // ── Ciclos ───────────────────────────────────────────────────────────────

  @Get('ciclos')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar ciclos de billing do cliente' })
  async listCiclos() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.cicloFilter.execute(clienteId);
    return items.map(BillingViewModel.cicloToHttp);
  }

  @Post('ciclos')
  @Roles('admin')
  @ApiOperation({ summary: 'Criar ciclo de billing' })
  async createCiclo(@Body() body: CreateCicloBody) {
    const parsed = createCicloSchema.parse(body);
    const { ciclo } = await this.cicloCreate.execute(parsed);
    return BillingViewModel.cicloToHttp(ciclo);
  }

  // ── Quotas ───────────────────────────────────────────────────────────────

  @Get('quotas')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Obter quotas do cliente' })
  async getQuotas() {
    const clienteId = this.req['tenantId'] as string;
    const { quotas } = await this.quotasGet.execute(clienteId);
    if (!quotas) return null;
    return BillingViewModel.quotasToHttp(quotas);
  }

  @Put('quotas')
  @Roles('admin')
  @ApiOperation({ summary: 'Atualizar quotas do cliente' })
  async upsertQuotas(@Body() body: UpsertQuotasBody) {
    const parsed = upsertQuotasSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const { quotas } = await this.quotasUpsert.execute(clienteId, parsed);
    return BillingViewModel.quotasToHttp(quotas);
  }
}
