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
import { Request } from 'express';
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
  CreateImovelBody,
  createImovelSchema,
} from './dtos/create-imovel.body';
import {
  FilterImovelInput,
  filterImovelSchema,
} from './dtos/filter-imovel.input';
import { SaveImovelBody, saveImovelSchema } from './dtos/save-imovel.body';
import { CalcularScore } from './use-cases/calcular-score';
import { CreateImovel } from './use-cases/create-imovel';
import { DeleteImovel } from './use-cases/delete-imovel';
import { FilterImovel } from './use-cases/filter-imovel';
import { GetImovel } from './use-cases/get-imovel';
import { GetImovelResumo } from './use-cases/get-imovel-resumo';
import { ListImovelProblematicos } from './use-cases/list-imovel-problematicos';
import { ListImovelResumo } from './use-cases/list-imovel-resumo';
import { PaginationImovel } from './use-cases/pagination-imovel';
import { SaveImovel } from './use-cases/save-imovel';
import { ImovelViewModel } from './view-model/imovel';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Imóveis')
@Controller('imoveis')
export class ImovelController {
  constructor(
    private createImovel: CreateImovel,
    private deleteImovel: DeleteImovel,
    private filterImovel: FilterImovel,
    private getImovel: GetImovel,
    private paginationImovel: PaginationImovel,
    private saveImovel: SaveImovel,
    private calcularScore: CalcularScore,
    private listImovelResumoUc: ListImovelResumo,
    private getImovelResumoUc: GetImovelResumo,
    private listImovelProblematicosUc: ListImovelProblematicos,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar imóveis com filtros' })
  async filter(@Query() filters: FilterImovelInput) {
    const parsed = filterImovelSchema.parse(filters);
    const { imoveis } = await this.filterImovel.execute(parsed);
    return imoveis.map(ImovelViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar imóveis com paginação' })
  async pagination(
    @Query() filters: FilterImovelInput,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterImovelSchema.parse(filters);
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationImovel.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(ImovelViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get('resumo')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Lista resumo agregado dos imóveis (substitui v_imovel_resumo)' })
  async listResumo(@Query('regiaoId') regiaoId?: string) {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.listImovelResumoUc.execute(clienteId, regiaoId);
    return items;
  }

  @Get('problematicos')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Lista imóveis problemáticos (substitui v_imovel_historico_acesso)' })
  async listProblematicos() {
    const clienteId = this.req['tenantId'] as string;
    const { items } = await this.listImovelProblematicosUc.execute(clienteId);
    return items;
  }

  @Get(':id/score')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Calcula e grava score de risco do imóvel' })
  async score(@Param('id') id: string, @Query('clienteId') clienteId: string) {
    return this.calcularScore.execute(id, clienteId);
  }

  @Get(':id/resumo')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Resumo agregado de um imóvel por ID (substitui v_imovel_resumo)' })
  async getResumo(@Param('id') id: string) {
    const { resumo } = await this.getImovelResumoUc.execute(id);
    return resumo;
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar imóvel por ID' })
  async findById(@Param('id') id: string) {
    const { imovel } = await this.getImovel.execute(id);
    return ImovelViewModel.toHttp(imovel);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar imóvel' })
  async create(@Body() body: CreateImovelBody) {
    const parsed = createImovelSchema.parse(body);
    const { imovel } = await this.createImovel.execute(parsed);
    return ImovelViewModel.toHttp(imovel);
  }

  @Put(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar imóvel' })
  async save(@Param('id') id: string, @Body() body: SaveImovelBody) {
    const parsed = saveImovelSchema.parse(body);
    const { imovel } = await this.saveImovel.execute(id, parsed);
    return ImovelViewModel.toHttp(imovel);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover imóvel (soft delete)' })
  async remove(@Param('id') id: string) {
    const { imovel } = await this.deleteImovel.execute(id);
    return ImovelViewModel.toHttp(imovel);
  }
}
