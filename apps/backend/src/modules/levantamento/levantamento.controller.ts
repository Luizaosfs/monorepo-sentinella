import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  AddItemEvidenciaBody,
  addItemEvidenciaSchema,
} from './dtos/add-item-evidencia.body';
import {
  CreateLevantamentoBody,
  createLevantamentoSchema,
} from './dtos/create-levantamento.body';
import {
  CreateLevantamentoItemBody,
  createLevantamentoItemSchema,
} from './dtos/create-levantamento-item.body';
import {
  CriarItemManualBody,
  criarItemManualSchema,
} from './dtos/criar-item-manual.body';
import {
  FilterLevantamentoInput,
  filterLevantamentoSchema,
} from './dtos/filter-levantamento.input';
import {
  SaveLevantamentoBody,
  saveLevantamentoSchema,
} from './dtos/save-levantamento.body';
import {
  UpdateItemBody,
  updateItemSchema,
} from './dtos/update-item.body';
import { AddItemEvidencia } from './use-cases/add-item-evidencia';
import { CreateLevantamento } from './use-cases/create-levantamento';
import { CreateLevantamentoItem } from './use-cases/create-levantamento-item';
import { CriarItemManual } from './use-cases/criar-item-manual';
import { DeleteItem } from './use-cases/delete-item';
import { DeleteLevantamento } from './use-cases/delete-levantamento';
import { FilterLevantamento } from './use-cases/filter-levantamento';
import { GetItem } from './use-cases/get-item';
import { UpdateItem } from './use-cases/update-item';
import { GetLevantamento } from './use-cases/get-levantamento';
import { PaginationLevantamento } from './use-cases/pagination-levantamento';
import { SaveLevantamento } from './use-cases/save-levantamento';
import { LevantamentoViewModel } from './view-model/levantamento';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Levantamentos')
@Controller('levantamentos')
export class LevantamentoController {
  constructor(
    private addItemEvidencia: AddItemEvidencia,
    private createLevantamento: CreateLevantamento,
    private createLevantamentoItem: CreateLevantamentoItem,
    private criarItemManual: CriarItemManual,
    private deleteItem: DeleteItem,
    private deleteLevantamento: DeleteLevantamento,
    private filterLevantamento: FilterLevantamento,
    private getItem: GetItem,
    private getLevantamento: GetLevantamento,
    private paginationLevantamento: PaginationLevantamento,
    private saveLevantamento: SaveLevantamento,
    private updateItem: UpdateItem,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar levantamentos com filtros' })
  async filter(@Query() filters: FilterLevantamentoInput) {
    const parsed = filterLevantamentoSchema.parse(filters);
    const { levantamentos } = await this.filterLevantamento.execute(parsed);
    return levantamentos.map(LevantamentoViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar levantamentos com paginação' })
  async pagination(
    @Query() filters: FilterLevantamentoInput,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterLevantamentoSchema.parse(filters);
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationLevantamento.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(LevantamentoViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get('itens/:itemId')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar item por ID' })
  async getItemById(@Param('itemId') itemId: string) {
    const { item } = await this.getItem.execute(itemId);
    return LevantamentoViewModel.itemToHttp(item);
  }

  @Put('itens/:itemId')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Atualizar item de levantamento' })
  async updateItemRoute(@Param('itemId') itemId: string, @Body() body: UpdateItemBody) {
    const parsed = updateItemSchema.parse(body);
    const { item } = await this.updateItem.execute(itemId, parsed);
    return LevantamentoViewModel.itemToHttp(item);
  }

  @Delete('itens/:itemId')
  @Roles('admin', 'supervisor')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover item de levantamento (soft delete)' })
  async deleteItemRoute(@Param('itemId') itemId: string) {
    await this.deleteItem.execute(itemId);
  }

  @Post('itens/:itemId/evidencias')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Adicionar evidência fotográfica ao item' })
  async addItemEvidenciaRoute(
    @Param('itemId') itemId: string,
    @Body() body: AddItemEvidenciaBody,
  ) {
    const parsed = addItemEvidenciaSchema.parse(body);
    const { evidencia } = await this.addItemEvidencia.execute(itemId, parsed);
    return evidencia;
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar levantamento por ID (com itens)' })
  async findById(@Param('id') id: string) {
    const { levantamento } = await this.getLevantamento.execute(id);
    return LevantamentoViewModel.toHttp(levantamento);
  }

  @Post()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Criar levantamento' })
  async create(@Body() body: CreateLevantamentoBody) {
    const parsed = createLevantamentoSchema.parse(body);
    const { levantamento } = await this.createLevantamento.execute(parsed);
    return LevantamentoViewModel.toHttp(levantamento);
  }

  @Put(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Atualizar levantamento' })
  async save(@Param('id') id: string, @Body() body: SaveLevantamentoBody) {
    const parsed = saveLevantamentoSchema.parse(body);
    const { levantamento } = await this.saveLevantamento.execute(id, parsed);
    return LevantamentoViewModel.toHttp(levantamento);
  }

  @Get(':id/itens')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar itens do levantamento' })
  async getItens(@Param('id') id: string) {
    const { levantamento } = await this.getLevantamento.execute(id);
    return levantamento.itens?.map(LevantamentoViewModel.itemToHttp) ?? [];
  }

  @Post(':id/itens')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Adicionar item ao levantamento' })
  async createItem(
    @Param('id') id: string,
    @Body() body: CreateLevantamentoItemBody,
  ) {
    const parsed = createLevantamentoItemSchema.parse(body);
    const { item } = await this.createLevantamentoItem.execute(id, parsed);
    return LevantamentoViewModel.itemToHttp(item);
  }

  @Post('item-manual')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary: 'Criar item manual — busca ou cria levantamento para (cliente, planejamento, dataVoo)',
  })
  async itemManual(@Body() body: CriarItemManualBody) {
    const parsed = criarItemManualSchema.parse(body);
    const { levantamentoItem, levantamentoCriado, levantamentoId } =
      await this.criarItemManual.execute(parsed);
    return { levantamentoItem, levantamentoCriado, levantamentoId };
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover levantamento' })
  async remove(@Param('id') id: string) {
    await this.deleteLevantamento.execute(id);
  }
}
