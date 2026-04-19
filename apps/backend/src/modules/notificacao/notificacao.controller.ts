import {
  Body,
  Controller,
  Delete,
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
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateCasoBody,
  CreateEsusBody,
  CreatePushBody,
  CreateUnidadeBody,
  createCasoSchema,
  createEsusSchema,
  createPushSchema,
  createUnidadeSchema,
  SaveCasoBody,
  SaveUnidadeBody,
  saveCasoSchema,
  saveUnidadeSchema,
} from './dtos/create-notificacao.body';
import { CreateCaso } from './use-cases/create-caso';
import { CreateEsus } from './use-cases/create-esus';
import { CreatePush } from './use-cases/create-push';
import { CreateUnidade } from './use-cases/create-unidade';
import { DeleteCaso } from './use-cases/delete-caso';
import { DeletePush } from './use-cases/delete-push';
import { DeleteUnidade } from './use-cases/delete-unidade';
import { FilterCasos } from './use-cases/filter-casos';
import { FilterEsus } from './use-cases/filter-esus';
import { FilterUnidades } from './use-cases/filter-unidades';
import { GetCaso } from './use-cases/get-caso';
import { ListarNoRaio } from './use-cases/listar-no-raio';
import { PaginationCasos } from './use-cases/pagination-casos';
import { ProximoProtocolo } from './use-cases/proximo-protocolo';
import { SaveCaso } from './use-cases/save-caso';
import { SaveUnidade } from './use-cases/save-unidade';
import { NotificacaoViewModel } from './view-model/notificacao';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Notificações')
@Controller('notificacoes')
export class NotificacaoController {
  constructor(
    private unidadeFilter: FilterUnidades,
    private unidadeCreate: CreateUnidade,
    private unidadeSave: SaveUnidade,
    private unidadeDelete: DeleteUnidade,
    private casoFilter: FilterCasos,
    private casoGet: GetCaso,
    private casoCreate: CreateCaso,
    private casoSave: SaveCaso,
    private casoDelete: DeleteCaso,
    private pushCreate: CreatePush,
    private pushDelete: DeletePush,
    private esusFilter: FilterEsus,
    private esusCreate: CreateEsus,
    private casosPagination: PaginationCasos,
    private casosRaio: ListarNoRaio,
    private proximoProtocoloUc: ProximoProtocolo,
    @Inject(REQUEST) private req: Request,
  ) {}

  // ── Unidades de Saúde ─────────────────────────────────────────────────────

  @Get('unidades-saude')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Listar unidades de saúde' })
  async listUnidades() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.unidadeFilter.execute(clienteId);
    return items.map(NotificacaoViewModel.unidadeToHttp);
  }

  @Post('unidades-saude')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Cadastrar unidade de saúde' })
  async createUnidade(@Body() body: CreateUnidadeBody) {
    const parsed = createUnidadeSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const { unidade } = await this.unidadeCreate.execute(clienteId, parsed);
    return NotificacaoViewModel.unidadeToHttp(unidade);
  }

  @Put('unidades-saude/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar unidade de saúde' })
  async saveUnidade(@Param('id') id: string, @Body() body: SaveUnidadeBody) {
    const parsed = saveUnidadeSchema.parse(body);
    const { unidade } = await this.unidadeSave.execute(id, parsed);
    return NotificacaoViewModel.unidadeToHttp(unidade);
  }

  @Delete('unidades-saude/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover unidade de saúde' })
  async deleteUnidade(@Param('id') id: string) {
    await this.unidadeDelete.execute(id);
    return { deleted: true };
  }

  // ── Casos Notificados ────────────────────────────────────────────────────

  @Get('casos/paginated')
  @Roles('admin', 'supervisor', 'notificador', 'analista_regional')
  @ApiOperation({ summary: 'Listar casos notificados com paginação por cursor' })
  async listCasosPaginated(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const clienteId = this.req['tenantId'] as string;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    const result = await this.casosPagination.execute(clienteId, parsedLimit, cursor);
    return {
      items: result.items.map(NotificacaoViewModel.toHttp),
      nextCursor: result.nextCursor,
    };
  }

  @Get('casos/no-raio')
  @Roles('admin', 'supervisor', 'notificador', 'analista_regional')
  @ApiOperation({ summary: 'Listar casos dentro de um raio geográfico' })
  async listCasosNoRaio(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('raio') raio?: string,
  ) {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.casosRaio.execute(
      parseFloat(lat),
      parseFloat(lng),
      raio ? parseInt(raio, 10) : 500,
      clienteId,
    );
    return items.map(NotificacaoViewModel.toHttp);
  }

  @Get('casos')
  @Roles('admin', 'supervisor', 'notificador', 'analista_regional')
  @ApiOperation({ summary: 'Listar casos notificados' })
  async listCasos(
    @Query('status') status?: string,
    @Query('regiaoId') regiaoId?: string,
  ) {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.casoFilter.execute(clienteId, { status, regiaoId });
    return items.map(NotificacaoViewModel.toHttp);
  }

  @Get('casos/:id')
  @Roles('admin', 'supervisor', 'notificador', 'analista_regional')
  @ApiOperation({ summary: 'Detalhar caso notificado' })
  async getCaso(@Param('id') id: string) {
    const { caso } = await this.casoGet.execute(id);
    return NotificacaoViewModel.toHttp(caso);
  }

  @Post('casos')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Registrar caso notificado' })
  async createCaso(@Body() body: CreateCasoBody) {
    const parsed = createCasoSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as AuthenticatedUser).id;
    const { caso } = await this.casoCreate.execute(clienteId, userId, parsed);
    return NotificacaoViewModel.toHttp(caso);
  }

  @Put('casos/:id')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Atualizar caso notificado' })
  async saveCaso(@Param('id') id: string, @Body() body: SaveCasoBody) {
    const parsed = saveCasoSchema.parse(body);
    const { caso } = await this.casoSave.execute(id, parsed);
    return NotificacaoViewModel.toHttp(caso);
  }

  @Delete('casos/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover caso notificado' })
  async deleteCaso(@Param('id') id: string) {
    await this.casoDelete.execute(id);
    return { deleted: true };
  }

  // ── Push Subscriptions ───────────────────────────────────────────────────

  @Post('push')
  @Roles('admin', 'supervisor', 'agente', 'notificador')
  @ApiOperation({ summary: 'Registrar push subscription' })
  async createPush(@Body() body: CreatePushBody) {
    const parsed = createPushSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as AuthenticatedUser).id;
    const { push } = await this.pushCreate.execute(clienteId, userId, parsed);
    return NotificacaoViewModel.pushToHttp(push);
  }

  @Delete('push/:id')
  @Roles('admin', 'supervisor', 'agente', 'notificador')
  @ApiOperation({ summary: 'Remover push subscription' })
  async deletePush(@Param('id') id: string) {
    await this.pushDelete.execute(id);
    return { deleted: true };
  }

  // ── e-SUS ────────────────────────────────────────────────────────────────

  @Get('esus')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar notificações e-SUS' })
  async listEsus() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.esusFilter.execute(clienteId);
    return items.map(NotificacaoViewModel.esusToHttp);
  }

  @Post('esus')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Criar notificação e-SUS' })
  async createEsus(@Body() body: CreateEsusBody) {
    const parsed = createEsusSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as AuthenticatedUser).id;
    const { esus } = await this.esusCreate.execute(clienteId, userId, parsed);
    return NotificacaoViewModel.esusToHttp(esus);
  }

  // ── Protocolo ─────────────────────────────────────────────────────────────

  @Post('protocolo/proximo')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Gerar próximo número de protocolo' })
  async proximoProtocolo() {
    const clienteId = this.req['tenantId'] as string;
    return this.proximoProtocoloUc.execute(clienteId);
  }
}
