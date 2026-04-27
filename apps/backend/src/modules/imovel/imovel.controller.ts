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
import {
  PaginationProps,
  paginationSchema,
} from '@shared/dtos/pagination-body';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  BatchCreateImoveisBody,
  batchCreateImoveisSchema,
} from './dtos/batch-create-imoveis.body';
import {
  CreateImovelBody,
  createImovelSchema,
} from './dtos/create-imovel.body';
import {
  FilterImovelInput,
  filterImovelSchema,
} from './dtos/filter-imovel.input';
import {
  FindByEnderecoQuery,
  findByEnderecoSchema,
} from './dtos/find-by-endereco.input';
import { SaveImovelBody, saveImovelSchema } from './dtos/save-imovel.body';
import { BatchCreateImoveis } from './use-cases/batch-create-imoveis';
import { BuscarChavesExistentes } from './use-cases/buscar-chaves-existentes';
import { CalcularScore } from './use-cases/calcular-score';
import { CountPrioridadeDrone } from './use-cases/count-prioridade-drone';
import { CreateImovel } from './use-cases/create-imovel';
import { DeleteImovel } from './use-cases/delete-imovel';
import { FindByEndereco } from './use-cases/find-by-endereco';
import { FilterImovel } from './use-cases/filter-imovel';
import { GetImovel } from './use-cases/get-imovel';
import { GetImovelResumo } from './use-cases/get-imovel-resumo';
import { ListImovelProblematicos } from './use-cases/list-imovel-problematicos';
import { ListImovelResumo } from './use-cases/list-imovel-resumo';
import { PaginationImovel } from './use-cases/pagination-imovel';
import { SaveImovel } from './use-cases/save-imovel';
import { ImovelViewModel } from './view-model/imovel';

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
    private findByEnderecoUc: FindByEndereco,
    private buscarChavesExistentesUc: BuscarChavesExistentes,
    private countPrioridadeDroneUc: CountPrioridadeDrone,
    private batchCreateImoveisUc: BatchCreateImoveis,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar imóveis com filtros' })
  async filter(@Query() filters: FilterImovelInput) {
    const parsed = filterImovelSchema.parse(filters);
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsed.clienteId = this.req['tenantId'] as string | undefined;
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
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsedFilters.clienteId = this.req['tenantId'] as string | undefined;
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

  @Get('by-endereco')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar imóvel por logradouro e número (ILIKE)' })
  async findByEnderecoRoute(@Query() query: FindByEnderecoQuery) {
    const parsed = findByEnderecoSchema.parse(query);
    const { imovel } = await this.findByEnderecoUc.execute(parsed.logradouro, parsed.numero);
    return imovel ? ImovelViewModel.toHttp(imovel) : null;
  }

  @Get('chaves-existentes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Retorna chaves logradouro|numero|bairro de imóveis ativos (deduplicação CSV)' })
  async chavesExistentes() {
    return this.buscarChavesExistentesUc.execute();
  }

  @Get('count-prioridade-drone')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Contagem de imóveis com prioridade_drone=true' })
  async countPrioridadeDrone() {
    return this.countPrioridadeDroneUc.execute();
  }

  @Get(':id/score')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Calcula e grava score de risco do imóvel' })
  async score(@Param('id') id: string) {
    // MT-03: clienteId vem do TenantGuard, não de query param
    const clienteId = this.req['tenantId'] as string;
    return this.calcularScore.execute(id, clienteId);
  }

  @Get(':id/resumo')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Resumo agregado de um imóvel por ID (substitui v_imovel_resumo)' })
  async getResumo(@Param('id') id: string) {
    const { resumo } = await this.getImovelResumoUc.execute(id, this.req['tenantId'] as string | null);
    return resumo;
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar imóvel por ID' })
  async findById(@Param('id') id: string) {
    const { imovel } = await this.getImovel.execute(id, this.req['tenantId'] as string | null);
    return ImovelViewModel.toHttp(imovel);
  }

  @Post('batch')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Importação em lote de imóveis (CSV)' })
  async batchCreate(@Body() body: BatchCreateImoveisBody) {
    const parsed = batchCreateImoveisSchema.parse(body);
    return this.batchCreateImoveisUc.execute(parsed);
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
    const { imovel } = await this.saveImovel.execute(id, parsed, (this.req['tenantId'] as string | undefined) ?? null);
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
