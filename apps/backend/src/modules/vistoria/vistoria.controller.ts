import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { Roles } from '@/decorators/roles.decorator';

import {
  AddDepositoBody,
  addDepositoSchema,
  AddSintomasBody,
  addSintomasSchema,
  AddRiscosBody,
  addRiscosSchema,
} from './dtos/add-vistoria-child.body';
import {
  CreateVistoriaBody,
  createVistoriaSchema,
} from './dtos/create-vistoria.body';
import {
  CreateVistoriaCompletaBody,
  createVistoriaCompletaSchema,
} from './dtos/create-vistoria-completa.body';
import {
  FilterVistoriaConsolidadasQuery,
  filterVistoriaConsolidadasSchema,
} from './dtos/filter-vistoria-consolidadas.input';
import {
  FilterVistoriaQuery,
  filterVistoriaSchema,
} from './dtos/filter-vistoria.input';
import {
  SaveVistoriaBody,
  saveVistoriaSchema,
} from './dtos/save-vistoria.body';
import { AddDeposito } from './use-cases/add-deposito';
import { AddSintomas } from './use-cases/add-sintomas';
import { AddRiscos } from './use-cases/add-riscos';
import { CountVistoria } from './use-cases/count-vistoria';
import { CreateVistoria } from './use-cases/create-vistoria';
import { CreateVistoriaCompleta } from './use-cases/create-vistoria-completa';
import { FilterVistoria } from './use-cases/filter-vistoria';
import { GetVistoria } from './use-cases/get-vistoria';
import { ListVistoriasConsolidadas } from './use-cases/list-vistorias-consolidadas';
import { PaginationVistoria } from './use-cases/pagination-vistoria';
import { SaveVistoria } from './use-cases/save-vistoria';
import { SoftDeleteVistoria } from './use-cases/soft-delete-vistoria';
import { VistoriaViewModel } from './view-model/vistoria';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Vistorias')
@Controller('vistorias')
export class VistoriaController {
  constructor(
    private createVistoria: CreateVistoria,
    private createVistoriaCompleta: CreateVistoriaCompleta,
    private getVistoria: GetVistoria,
    private filterVistoria: FilterVistoria,
    private listVistoriasConsolidadas: ListVistoriasConsolidadas,
    private paginationVistoria: PaginationVistoria,
    private saveVistoria: SaveVistoria,
    private countVistoria: CountVistoria,
    private addDepositoUc: AddDeposito,
    private addSintomasUc: AddSintomas,
    private addRiscosUc: AddRiscos,
    private softDeleteVistoria: SoftDeleteVistoria,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('consolidadas')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar vistorias consolidadas com score de prioridade' })
  async listConsolidadas(@Query() filters: FilterVistoriaConsolidadasQuery) {
    const parsed = filterVistoriaConsolidadasSchema.parse(filters);
    const { vistorias } = await this.listVistoriasConsolidadas.execute(parsed);
    return vistorias;
  }

  @Get('count')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Contar vistorias com filtros' })
  async count(@Query() filters: FilterVistoriaQuery) {
    const parsed = filterVistoriaSchema.parse(filters);
    return this.countVistoria.execute(parsed);
  }

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar vistorias com filtros' })
  async filter(@Query() filters: FilterVistoriaQuery) {
    const parsed = filterVistoriaSchema.parse(filters);
    const { vistorias } = await this.filterVistoria.execute(parsed);
    return vistorias.map(VistoriaViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar vistorias com paginação' })
  async pagination(
    @Query() filters: FilterVistoriaQuery,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterVistoriaSchema.parse(filters);
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationVistoria.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(VistoriaViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary:
      'Buscar vistoria por ID (com depósitos, sintomas, riscos e calhas)',
  })
  async findById(@Param('id') id: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const { vistoria } = await this.getVistoria.execute(id, clienteId);
    return VistoriaViewModel.toHttp(vistoria);
  }

  @Post()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Criar vistoria' })
  async create(@Body() body: CreateVistoriaBody) {
    const parsed = createVistoriaSchema.parse(body);
    const { vistoria } = await this.createVistoria.execute(parsed);
    return VistoriaViewModel.toHttp(vistoria);
  }

  @Post('completa')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary:
      'Criar vistoria completa em transação (depositos + sintomas + riscos + calhas). Suporta idempotência via idempotencyKey.',
  })
  async createCompleta(@Body() body: CreateVistoriaCompletaBody) {
    const parsed = createVistoriaCompletaSchema.parse(body);
    return this.createVistoriaCompleta.execute(parsed);
  }

  @Post(':id/depositos')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Adicionar depósito a uma vistoria' })
  async addDeposito(@Param('id') id: string, @Body() body: AddDepositoBody) {
    const parsed = addDepositoSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.addDepositoUc.execute(id, clienteId, parsed);
  }

  @Post('sintomas')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Registrar sintomas de uma vistoria' })
  async addSintomas(@Body() body: AddSintomasBody) {
    const parsed = addSintomasSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.addSintomasUc.execute(clienteId, parsed);
  }

  @Post('riscos')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Registrar riscos de uma vistoria' })
  async addRiscos(@Body() body: AddRiscosBody) {
    const parsed = addRiscosSchema.parse(body);
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.addRiscosUc.execute(clienteId, parsed);
  }

  @Put(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Atualizar vistoria' })
  async save(@Param('id') id: string, @Body() body: SaveVistoriaBody) {
    const parsed = saveVistoriaSchema.parse(body);
    const { vistoria } = await this.saveVistoria.execute(id, parsed);
    return VistoriaViewModel.toHttp(vistoria);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Soft delete de vistoria (K.7 — fn_orfaos_vistoria)' })
  async softDelete(@Param('id') id: string): Promise<void> {
    await this.softDeleteVistoria.execute(id);
  }
}
