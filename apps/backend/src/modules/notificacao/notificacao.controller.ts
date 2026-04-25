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
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateCasoBody,
  CreateEsusBody,
  CreatePushBody,
  CreateUnidadeBody,
  EnviarEsusBody,
  createCasoSchema,
  createEsusSchema,
  createPushSchema,
  createUnidadeSchema,
  enviarEsusSchema,
  SaveCasoBody,
  SaveUnidadeBody,
  saveCasoSchema,
  saveUnidadeSchema,
} from './dtos/create-notificacao.body';
import { CreateCaso } from './use-cases/create-caso';
import { CreateEsus } from './use-cases/create-esus';
import { CreatePush } from './use-cases/create-push';
import { EnviarEsus } from './use-cases/enviar-esus';
import { ReenviarEsus } from './use-cases/reenviar-esus';
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
import {
  ListCasosPaginadoQuery,
  listCasosPaginadoSchema,
  ListCasoIdsComCruzamentoBody,
  listCasoIdsComCruzamentoSchema,
} from './dtos/casos-cruzamentos.body';
import { CountCruzadosHoje } from './use-cases/count-cruzados-hoje';
import { CountProximosAoItem } from './use-cases/count-proximos-ao-item';
import { CruzamentosDocaso } from './use-cases/cruzamentos-do-caso';
import { CruzamentosDoItem } from './use-cases/cruzamentos-do-item';
import { ListarCasosPaginado } from './use-cases/listar-casos-paginado';
import { ListCasoIdsComCruzamento } from './use-cases/list-caso-ids-com-cruzamento';
import { ListCruzamentos } from './use-cases/list-cruzamentos';
import { GetCruzamentoCount } from './use-cases/get-cruzamento-count';

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
    private esusEnviar: EnviarEsus,
    private esusReenviar: ReenviarEsus,
    private casosPagination: PaginationCasos,
    private casosRaio: ListarNoRaio,
    private proximoProtocoloUc: ProximoProtocolo,
    private casosPaginadoUc: ListarCasosPaginado,
    private countProximosUc: CountProximosAoItem,
    private cruzamentosDoItemUc: CruzamentosDoItem,
    private cruzamentosDocasoUc: CruzamentosDocaso,
    private countCruzadosHojeUc: CountCruzadosHoje,
    private listCasoIdsUc: ListCasoIdsComCruzamento,
    private listCruzamentosUc: ListCruzamentos,
    private getCruzamentoCountUc: GetCruzamentoCount,
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

  @Get('casos/paginado')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Listar casos paginado por cursor — retorna { data, nextCursor }' })
  async listCasosPaginado(@Query() query: ListCasosPaginadoQuery) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = listCasosPaginadoSchema.parse(query);
    return this.casosPaginadoUc.execute(clienteId, parsed);
  }

  @Get('casos/count-proximos')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Contar casos notificados num raio de 300m de um item de levantamento' })
  async countProximosAoItem(@Query('itemId') itemId: string) {
    const clienteId = this.req['tenantId'] as string;
    const total = await this.countProximosUc.execute(itemId, clienteId);
    return { total };
  }

  @Get('casos/cruzamentos-do-item')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Cruzamentos de casos notificados para um item de levantamento' })
  async cruzamentosDoItem(@Query('itemId') itemId: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.cruzamentosDoItemUc.execute(itemId, clienteId);
  }

  @Get('casos/cruzados-hoje/count')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Contar casos distintos cruzados com focos hoje' })
  async countCruzadosHoje() {
    const clienteId = this.req['tenantId'] as string;
    const total = await this.countCruzadosHojeUc.execute(clienteId);
    return { total };
  }

  @Post('cruzamentos/caso-ids')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Filtrar quais casoIds possuem ao menos um cruzamento registrado' })
  async listCasoIdsComCruzamento(@Body() body: ListCasoIdsComCruzamentoBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = listCasoIdsComCruzamentoSchema.parse(body);
    return this.listCasoIdsUc.execute(parsed.casoIds, clienteId);
  }

  @Get('cruzamentos/count-com-item')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Count de itens de levantamento com cruzamento ativo (widget dashboard)' })
  async getCruzamentoCount() {
    const clienteId = this.req['tenantId'] as string;
    const count = await this.getCruzamentoCountUc.execute(clienteId);
    return { count };
  }

  @Get('cruzamentos')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Listar cruzamentos recentes (máx. 200) do cliente' })
  async listCruzamentos() {
    const clienteId = this.req['tenantId'] as string;
    return this.listCruzamentosUc.execute(clienteId);
  }

  @Get('casos/paginated')
  @Roles('admin', 'supervisor', 'notificador')
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
  @Roles('admin', 'supervisor', 'notificador')
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
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Listar casos notificados' })
  async listCasos(
    @Query('status') status?: string,
    @Query('regiaoId') regiaoId?: string,
  ) {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.casoFilter.execute(clienteId, { status, regiaoId });
    return items.map(NotificacaoViewModel.toHttp);
  }

  @Get('casos/:id/cruzamentos')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Cruzamentos de focos de risco para um caso notificado' })
  async cruzamentosDocaso(@Param('id') id: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.cruzamentosDocasoUc.execute(id, clienteId);
  }

  @Get('casos/:id')
  @Roles('admin', 'supervisor', 'notificador')
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

  @Post('esus/enviar')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Enviar notificação ao e-SUS Notifica (POST direto à API do Ministério da Saúde)' })
  async enviarEsus(@Body() body: EnviarEsusBody) {
    const parsed = enviarEsusSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as { id?: string } | undefined)?.id;
    return this.esusEnviar.execute(clienteId, parsed, userId);
  }

  @Post('esus/:id/reenviar')
  @Roles('admin', 'supervisor', 'notificador')
  @ApiOperation({ summary: 'Reenviar notificação e-SUS com status=erro' })
  async reenviarEsus(@Param('id') id: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.esusReenviar.execute(id, clienteId);
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
