import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PaginationProps,
  paginationSchema,
} from '@shared/dtos/pagination-body';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  AtribuirAgenteBody,
  atribuirAgenteSchema,
} from './dtos/atribuir-agente.body';
import {
  AtribuirAgenteLoteBody,
  atribuirAgenteLoteSchema,
} from './dtos/atribuir-agente-lote.body';
import {
  ClassificacaoInicialBody,
  classificacaoInicialSchema,
} from './dtos/classificacao-inicial.body';
import {
  CreateFocoRiscoBody,
  createFocoRiscoSchema,
} from './dtos/create-foco-risco.body';
import {
  FilterFocoRiscoInput,
  filterFocoRiscoSchema,
} from './dtos/filter-foco-risco.input';
import {
  IniciarInspecaoBody,
  iniciarInspecaoSchema,
} from './dtos/iniciar-inspecao.body';
import {
  TransicionarFocoRiscoBody,
  transicionarFocoRiscoSchema,
} from './dtos/transicionar-foco-risco.body';
import {
  UpdateFocoRiscoBody,
  updateFocoRiscoSchema,
} from './dtos/update-foco-risco.body';
import { ContagemPorStatus } from './use-cases/contagem-por-status';
import { AtribuirAgente } from './use-cases/atribuir-agente';
import { AtribuirAgenteLote } from './use-cases/atribuir-agente-lote';
import { AtualizarClassificacao } from './use-cases/atualizar-classificacao';
import { ContagemTriagemFila } from './use-cases/contagem-triagem-fila';
import { CreateFocoRisco } from './use-cases/create-foco-risco';
import { FilterFocoRisco } from './use-cases/filter-foco-risco';
import { GetFocoAtivoById } from './use-cases/get-foco-ativo-by-id';
import { GetFocoHistorico } from './use-cases/get-foco-historico';
import { GetFocoTimeline } from './use-cases/get-foco-timeline';
import { GetFocoRisco } from './use-cases/get-foco-risco';
import { IniciarInspecao } from './use-cases/iniciar-inspecao';
import { ListFocosByIds } from './use-cases/list-focos-by-ids';
import { PaginationFocoRisco } from './use-cases/pagination-foco-risco';
import { TransicionarFocoRisco } from './use-cases/transicionar-foco-risco';
import { UpdateFocoRisco } from './use-cases/update-foco-risco';
import { FocoRiscoViewModel } from './view-model/foco-risco';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Focos de Risco')
@Controller('focos-risco')
export class FocoRiscoController {
  constructor(
    private contagemPorStatusUc: ContagemPorStatus,
    private atribuirAgente: AtribuirAgente,
    private atribuirAgenteLote: AtribuirAgenteLote,
    private atualizarClassificacao: AtualizarClassificacao,
    private createFocoRisco: CreateFocoRisco,
    private filterFocoRisco: FilterFocoRisco,
    private getFocoRisco: GetFocoRisco,
    private iniciarInspecao: IniciarInspecao,
    private paginationFocoRisco: PaginationFocoRisco,
    private transicionarFocoRisco: TransicionarFocoRisco,
    private contagemTriagemFilaUc: ContagemTriagemFila,
    private getFocoAtivoByIdUc: GetFocoAtivoById,
    private getFocoHistoricoUc: GetFocoHistorico,
    private getFocoTimelineUc: GetFocoTimeline,
    private listFocosByIdsUc: ListFocosByIds,
    private updateFocoRiscoUc: UpdateFocoRisco,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar focos de risco com filtros (suporta page/pageSize/orderBy)' })
  async filter(@Query() filters: FilterFocoRiscoInput) {
    const parsed = filterFocoRiscoSchema.parse(filters);
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsed.clienteId = this.req['tenantId'] as string | undefined;

    // Se o frontend enviou page/pageSize, retorna resposta paginada
    if (parsed.page != null || parsed.pageSize != null) {
      // Derivar orderKey + orderValue de ?orderBy=suspeita_em_asc
      let orderKey = 'created_at';
      let orderValue: 'asc' | 'desc' = 'desc';
      if (parsed.orderBy) {
        const lastUnderscore = parsed.orderBy.lastIndexOf('_');
        if (lastUnderscore > 0) {
          const direction = parsed.orderBy.slice(lastUnderscore + 1);
          if (direction === 'asc' || direction === 'desc') {
            orderKey = parsed.orderBy.slice(0, lastUnderscore);
            orderValue = direction;
          }
        }
      }
      // Bypass paginationSchema para não clampear pageSize (mapa precisa de até 5000)
      const pagination = {
        currentPage: Math.max(1, parsed.page ?? 1),
        perPage: Math.min(Math.max(1, parsed.pageSize ?? 30), 5000),
        orderKey,
        orderValue,
      } as PaginationProps;
      const result = await this.paginationFocoRisco.execute(parsed, pagination);
      return {
        items: result.items.map((f) => FocoRiscoViewModel.toHttp(f)),
        pagination: result.pagination,
      };
    }

    const { focos } = await this.filterFocoRisco.execute(parsed);
    return focos.map((f) => FocoRiscoViewModel.toHttp(f));
  }

  @Get('pagination')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar focos de risco com paginação' })
  async pagination(
    @Query() filters: FilterFocoRiscoInput,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterFocoRiscoSchema.parse(filters);
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsedFilters.clienteId = this.req['tenantId'] as string | undefined;
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationFocoRisco.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map((f) => FocoRiscoViewModel.toHttp(f)),
      pagination: result.pagination,
    };
  }

  @Get('contagem-triagem')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Contagem agregada para fila de triagem' })
  async contagemTriagem(@Query() filters: FilterFocoRiscoInput) {
    const parsed = filterFocoRiscoSchema.parse(filters);
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsed.clienteId = this.req['tenantId'] as string | undefined;
    return this.contagemTriagemFilaUc.execute(parsed);
  }

  @Get('contagem-por-status')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Contagem de focos agrupados por status' })
  async contagemPorStatus() {
    // MT-03: clienteId vem do TenantGuard, não de query param
    const clienteId = this.req['tenantId'] as string;
    return this.contagemPorStatusUc.execute(clienteId);
  }

  @Get('by-ids')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar múltiplos focos por IDs' })
  async byIds(@Query('ids') ids: string | string[]) {
    const clienteId = this.req['tenantId'] as string;
    const idsArr = Array.isArray(ids) ? ids : ids ? [ids] : [];
    const { focos } = await this.listFocosByIdsUc.execute(idsArr, clienteId);
    return focos;
  }

  @Get(':id/ativo')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar foco ativo por ID (retorna null se terminal)' })
  async getAtivo(@Param('id') id: string) {
    return this.getFocoAtivoByIdUc.execute(id, this.req['tenantId'] as string | null);
  }

  @Get(':id/historico')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Histórico de transições do foco' })
  async getHistorico(@Param('id') id: string) {
    return this.getFocoHistoricoUc.execute(id, this.req['tenantId'] as string | null);
  }

  @Get(':id/timeline')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Timeline unificada do foco (estados, vistorias, SLA, casos)' })
  async getTimeline(@Param('id') id: string) {
    return this.getFocoTimelineUc.execute(id);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary:
      'Buscar foco de risco por ID (histórico + resumo SLA: fase, prazo da fase, sla_operacional)',
  })
  async findById(@Param('id') id: string) {
    const { foco, sla, consolidacao } = await this.getFocoRisco.execute(id, this.req['tenantId'] as string | null);
    return FocoRiscoViewModel.toHttp(foco, sla, consolidacao);
  }

  @Post()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Criar foco de risco' })
  async create(@Body() body: CreateFocoRiscoBody) {
    const parsed = createFocoRiscoSchema.parse(body);
    const { foco } = await this.createFocoRisco.execute(parsed);
    return FocoRiscoViewModel.toHttp(foco);
  }

  @Post(':id/transicionar')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary: 'Transicionar status do foco de risco (máquina de estados)',
  })
  async transicionar(
    @Param('id') id: string,
    @Body() body: TransicionarFocoRiscoBody,
  ) {
    const parsed = transicionarFocoRiscoSchema.parse(body);
    const { foco } = await this.transicionarFocoRisco.execute(id, parsed);
    return FocoRiscoViewModel.toHttp(foco);
  }

  @Patch(':id/iniciar-inspecao')
  @Roles('admin', 'agente')
  @ApiOperation({
    summary:
      'Iniciar inspeção no local (aguarda_inspecao → em_inspecao). Apenas o agente responsável atribuído ou admin.',
  })
  async iniciarInspecaoEndpoint(
    @Param('id') id: string,
    @Body() body: IniciarInspecaoBody,
  ) {
    const parsed = iniciarInspecaoSchema.parse(body);
    const { foco } = await this.iniciarInspecao.execute(id, parsed);
    return FocoRiscoViewModel.toHttp(foco);
  }

  @Patch(':id/atribuir-agente')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atribuir agente responsável ao foco' })
  async atribuirAgenteEndpoint(
    @Param('id') id: string,
    @Body() body: AtribuirAgenteBody,
  ) {
    const parsed = atribuirAgenteSchema.parse(body);
    const { foco } = await this.atribuirAgente.execute(id, parsed);
    return FocoRiscoViewModel.toHttp(foco);
  }

  @Patch(':id/classificacao')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar classificação inicial do foco' })
  async atualizarClassificacaoEndpoint(
    @Param('id') id: string,
    @Body() body: ClassificacaoInicialBody,
  ) {
    const parsed = classificacaoInicialSchema.parse(body);
    const { foco } = await this.atualizarClassificacao.execute(id, parsed);
    return FocoRiscoViewModel.toHttp(foco);
  }

  @Patch(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Atualizar metadados do foco (responsável, desfecho, imóvel)' })
  async update(@Param('id') id: string, @Body() body: UpdateFocoRiscoBody) {
    const parsed = updateFocoRiscoSchema.parse(body);
    await this.updateFocoRiscoUc.execute(id, parsed);
    return { ok: true };
  }

  @Post('atribuir-agente-lote')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atribuir agente a múltiplos focos em lote' })
  async atribuirAgenteLoteEndpoint(@Body() body: AtribuirAgenteLoteBody) {
    const parsed = atribuirAgenteLoteSchema.parse(body);
    return this.atribuirAgenteLote.execute(parsed);
  }

  @Get('by-levantamento-item')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar foco vinculado a um levantamento_item' })
  async byLevantamentoItem(@Query('itemId') itemId: string) {
    const clienteId = this.req['tenantId'] as string;
    const rows = await this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM focos_risco WHERE origem_levantamento_item_id = ${itemId}::uuid AND cliente_id = ${clienteId}::uuid AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  }

  @Get('by-imovel')
  @Roles('admin', 'supervisor', 'agente', 'analista_regional')
  @ApiOperation({ summary: 'Listar focos de um imóvel (histórico completo)' })
  async listByImovel(@Query('imovelId') imovelId: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM focos_risco WHERE imovel_id = ${imovelId}::uuid AND cliente_id = ${clienteId}::uuid AND deleted_at IS NULL ORDER BY created_at DESC`,
    );
  }

  @Get('analytics')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Contagem de focos por status e prioridade' })
  async analytics() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`
        SELECT
          status,
          prioridade,
          COUNT(*) AS total
        FROM focos_risco
        WHERE cliente_id = ${clienteId}::uuid
          AND deleted_at IS NULL
        GROUP BY status, prioridade
        ORDER BY status, prioridade
      `,
    );
  }
}
