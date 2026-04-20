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
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import {
  PaginationProps,
  paginationSchema,
} from '@shared/dtos/pagination-body';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  AddEvidenciaBody,
  addEvidenciaSchema,
} from './dtos/add-evidencia.body';
import {
  ListExistingItemIdsBody,
  listExistingItemIdsSchema,
  ResolverStatusItemBody,
  resolverStatusItemSchema,
} from './dtos/resolver-status-item.body';
import {
  BulkInsertOperacoesBody,
  bulkInsertOperacoesSchema,
} from './dtos/bulk-insert-operacoes.body';
import {
  ConcluirParaItemBody,
  concluirParaItemSchema,
} from './dtos/concluir-para-item-operacao.body';
import {
  CreateOperacaoBody,
  createOperacaoSchema,
} from './dtos/create-operacao.body';
import {
  CriarParaItemBody,
  criarParaItemSchema,
} from './dtos/criar-para-item.body';
import {
  EnsureAndConcluirBody,
  ensureAndConcluirSchema,
} from './dtos/ensure-and-concluir.body';
import {
  EnsureEmAndamentoBody,
  ensureEmAndamentoSchema,
} from './dtos/ensure-em-andamento.body';
import {
  FilterOperacaoQuery,
  filterOperacaoSchema,
} from './dtos/filter-operacao.input';
import {
  SaveOperacaoBody,
  saveOperacaoSchema,
} from './dtos/save-operacao.body';
import {
  UpsertOperacaoBody,
  upsertOperacaoSchema,
} from './dtos/upsert-operacao.body';
import { AddEvidencia } from './use-cases/add-evidencia';
import { ListExistingItemIds } from './use-cases/list-existing-item-ids';
import { ResolverStatusItem } from './use-cases/resolver-status-item';
import { BulkInsertOperacoes } from './use-cases/bulk-insert-operacoes';
import { ConcluirParaItemOperacao } from './use-cases/concluir-para-item-operacao';
import { CreateOperacao } from './use-cases/create-operacao';
import { CriarParaItem } from './use-cases/criar-para-item';
import { DeleteOperacao } from './use-cases/delete-operacao';
import { EnsureAndConcluir } from './use-cases/ensure-and-concluir';
import { EnsureEmAndamento } from './use-cases/ensure-em-andamento';
import { EnviarEquipe } from './use-cases/enviar-equipe';
import { FilterOperacao } from './use-cases/filter-operacao';
import { GetOperacao } from './use-cases/get-operacao';
import { ListarComVinculos, ListarComVinculosFilter } from './use-cases/listar-com-vinculos';
import { PaginationOperacao } from './use-cases/pagination-operacao';
import { ResolverOperacao } from './use-cases/resolver-operacao';
import { SaveOperacao } from './use-cases/save-operacao';
import { StatsOperacao } from './use-cases/stats-operacao';
import { UpsertOperacao } from './use-cases/upsert-operacao';
import { OperacaoViewModel } from './view-model/operacao';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Operações')
@Controller('operacoes')
export class OperacaoController {
  constructor(
    private filterOperacao: FilterOperacao,
    private paginationOperacao: PaginationOperacao,
    private getOperacao: GetOperacao,
    private statsOperacao: StatsOperacao,
    private createOperacao: CreateOperacao,
    private saveOperacao: SaveOperacao,
    private criarParaItem: CriarParaItem,
    private enviarEquipe: EnviarEquipe,
    private resolverOperacao: ResolverOperacao,
    private addEvidencia: AddEvidencia,
    private deleteOperacao: DeleteOperacao,
    private upsertOperacao: UpsertOperacao,
    private bulkInsertOperacoes: BulkInsertOperacoes,
    private concluirParaItemOperacao: ConcluirParaItemOperacao,
    private listarComVinculos: ListarComVinculos,
    private ensureEmAndamento: EnsureEmAndamento,
    private ensureAndConcluir: EnsureAndConcluir,
    private resolverStatusItemUc: ResolverStatusItem,
    private listExistingItemIdsUc: ListExistingItemIds,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar operações do cliente' })
  async filter(@Query() filters: FilterOperacaoQuery) {
    const parsed = filterOperacaoSchema.parse(filters);
    const { operacoes } = await this.filterOperacao.execute(parsed);
    return operacoes.map(OperacaoViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Operações paginadas' })
  async pagination(
    @Query() filters: FilterOperacaoQuery,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterOperacaoSchema.parse(filters);
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationOperacao.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(OperacaoViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get('stats')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Estatísticas de operações por status' })
  async stats() {
    return this.statsOperacao.execute();
  }

  @Get('com-vinculos')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar operações com vínculos (foco, responsável, região)' })
  async listarComVinculosRoute(@Query() query: ListarComVinculosFilter) {
    return this.listarComVinculos.execute(query);
  }

  @Post('resolver-status-item')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Resolver foco de risco vinculado a um item de levantamento' })
  async resolverStatusItem(@Body() body: ResolverStatusItemBody) {
    const parsed = resolverStatusItemSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as AuthenticatedUser | undefined)?.id;
    await this.resolverStatusItemUc.execute(parsed.itemId, clienteId, userId);
    return { ok: true };
  }

  @Post('existing-item-ids')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar IDs de itens que já possuem operação pendente/em_andamento' })
  async listExistingItemIds(@Body() body: ListExistingItemIdsBody) {
    const parsed = listExistingItemIdsSchema.parse(body);
    const clienteId = this.req['tenantId'] as string;
    return this.listExistingItemIdsUc.execute(clienteId, parsed.itemIds);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar operação com evidências' })
  async findById(@Param('id') id: string) {
    const { operacao } = await this.getOperacao.execute(id);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar operação' })
  async create(@Body() body: CreateOperacaoBody) {
    const parsed = createOperacaoSchema.parse(body);
    const { operacao } = await this.createOperacao.execute(parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Put(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar operação' })
  async save(@Param('id') id: string, @Body() body: SaveOperacaoBody) {
    const parsed = saveOperacaoSchema.parse(body);
    const { operacao } = await this.saveOperacao.execute(id, parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post('upsert')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar ou atualizar operação (upsert por id)' })
  async upsert(@Body() body: UpsertOperacaoBody) {
    const parsed = upsertOperacaoSchema.parse(body);
    const { operacao } = await this.upsertOperacao.execute(parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post('bulk-insert')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Inserir múltiplas operações ignorando duplicatas' })
  async bulkInsert(@Body() body: BulkInsertOperacoesBody) {
    const parsed = bulkInsertOperacoesSchema.parse(body);
    const { operacoes, skipped } = await this.bulkInsertOperacoes.execute(parsed);
    return { operacoes: operacoes.map(OperacaoViewModel.toHttp), skipped };
  }

  @Post('concluir-para-item')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Concluir operação ativa vinculada a item de levantamento' })
  async concluirParaItemRoute(@Body() body: ConcluirParaItemBody) {
    const parsed = concluirParaItemSchema.parse(body);
    const { operacao } = await this.concluirParaItemOperacao.execute(parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post('ensure-em-andamento')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Garantir que existe operação em andamento para o vínculo' })
  async ensureEmAndamentoRoute(@Body() body: EnsureEmAndamentoBody) {
    const parsed = ensureEmAndamentoSchema.parse(body);
    const { operacao } = await this.ensureEmAndamento.execute(parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post('ensure-and-concluir')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Garantir operação e concluí-la (SLA)' })
  async ensureAndConcluirRoute(@Body() body: EnsureAndConcluirBody) {
    const parsed = ensureAndConcluirSchema.parse(body);
    const { operacao } = await this.ensureAndConcluir.execute(parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post('criar-para-item')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary:
      'Criar operação vinculada a item de levantamento (verifica duplicata)',
  })
  async criarParaItemRoute(@Body() body: CriarParaItemBody) {
    const parsed = criarParaItemSchema.parse(body);
    const { operacao } = await this.criarParaItem.execute(parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post('enviar-equipe')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar operação em andamento com responsável' })
  async enviarEquipeRoute(@Body() body: CreateOperacaoBody) {
    const parsed = createOperacaoSchema.parse(body);
    const { operacao } = await this.enviarEquipe.execute(parsed);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post(':id/resolver')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Marcar operação como concluída' })
  async resolver(@Param('id') id: string) {
    const { operacao } = await this.resolverOperacao.execute(id);
    return OperacaoViewModel.toHttp(operacao);
  }

  @Post(':id/evidencias')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Adicionar evidência fotográfica' })
  async addEvidenciaRoute(
    @Param('id') id: string,
    @Body() body: AddEvidenciaBody,
  ) {
    const parsed = addEvidenciaSchema.parse(body);
    const { evidencia } = await this.addEvidencia.execute(id, parsed);
    return OperacaoViewModel.evidenciaToHttp(evidencia);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Soft delete de operação' })
  async remove(@Param('id') id: string) {
    return this.deleteOperacao.execute(id);
  }
}
