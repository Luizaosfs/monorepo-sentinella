import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PaginationProps,
  paginationSchema,
} from '@shared/dtos/pagination-body';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  AddEvidenciaBody,
  addEvidenciaSchema,
} from './dtos/add-evidencia.body';
import {
  CreateOperacaoBody,
  createOperacaoSchema,
} from './dtos/create-operacao.body';
import {
  CriarParaItemBody,
  criarParaItemSchema,
} from './dtos/criar-para-item.body';
import {
  FilterOperacaoQuery,
  filterOperacaoSchema,
} from './dtos/filter-operacao.input';
import {
  SaveOperacaoBody,
  saveOperacaoSchema,
} from './dtos/save-operacao.body';
import { AddEvidencia } from './use-cases/add-evidencia';
import { CreateOperacao } from './use-cases/create-operacao';
import { CriarParaItem } from './use-cases/criar-para-item';
import { DeleteOperacao } from './use-cases/delete-operacao';
import { EnviarEquipe } from './use-cases/enviar-equipe';
import { FilterOperacao } from './use-cases/filter-operacao';
import { GetOperacao } from './use-cases/get-operacao';
import { PaginationOperacao } from './use-cases/pagination-operacao';
import { ResolverOperacao } from './use-cases/resolver-operacao';
import { SaveOperacao } from './use-cases/save-operacao';
import { StatsOperacao } from './use-cases/stats-operacao';
import { OperacaoViewModel } from './view-model/operacao';

@UseGuards(TenantGuard)
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
