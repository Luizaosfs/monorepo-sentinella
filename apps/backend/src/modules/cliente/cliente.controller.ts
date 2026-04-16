import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
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
  CreateClienteBody,
  createClienteSchema,
} from './dtos/create-cliente.body';
import {
  FilterClienteInput,
  filterClienteSchema,
} from './dtos/filter-cliente.input';
import { SaveClienteBody, saveClienteSchema } from './dtos/save-cliente.body';
import { CreateCliente } from './use-cases/create-cliente';
import { FilterCliente } from './use-cases/filter-cliente';
import { GetCliente } from './use-cases/get-cliente';
import { GetIntegracaoApiKey } from './use-cases/get-integracao-api-key';
import { PaginationCliente } from './use-cases/pagination-cliente';
import { ResolverPorCoordenada } from './use-cases/resolver-por-coordenada';
import { SaveCliente } from './use-cases/save-cliente';
import { ClienteViewModel } from './view-model/cliente';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Clientes')
@Controller('clientes')
export class ClienteController {
  constructor(
    private createCliente: CreateCliente,
    private filterCliente: FilterCliente,
    private getCliente: GetCliente,
    private paginationCliente: PaginationCliente,
    private saveCliente: SaveCliente,
    private resolverPorCoordenada: ResolverPorCoordenada,
    private getIntegracaoApiKey: GetIntegracaoApiKey,
  ) {}

  @Get('resolver-coordenada')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Resolve cliente pelos bounds que contêm o ponto lat/lng' })
  async resolverCoordenada(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const parsed = z.object({ lat: z.coerce.number(), lng: z.coerce.number() }).parse({ lat, lng });
    const { cliente } = await this.resolverPorCoordenada.execute(parsed.lat, parsed.lng);
    return cliente;
  }

  @Get('integracoes/:id/api-key')
  @Roles('admin')
  @ApiOperation({ summary: 'Busca api_key de uma integração do cliente' })
  async getApiKey(@Param('id') id: string) {
    const { integracao } = await this.getIntegracaoApiKey.execute(id);
    return integracao;
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar clientes com filtros' })
  async filter(@Query() filters: FilterClienteInput) {
    const parsed = filterClienteSchema.parse(filters);
    const { clientes } = await this.filterCliente.execute(parsed);
    return clientes.map(ClienteViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin')
  @ApiOperation({ summary: 'Listar clientes com paginação' })
  async pagination(
    @Query() filters: FilterClienteInput,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterClienteSchema.parse(filters);
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationCliente.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(ClienteViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Buscar cliente por ID' })
  async findById(@Param('id') id: string) {
    const { cliente } = await this.getCliente.execute(id);
    return ClienteViewModel.toHttp(cliente);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Criar cliente' })
  async create(@Body() body: CreateClienteBody) {
    const parsed = createClienteSchema.parse(body);
    const { cliente } = await this.createCliente.execute(parsed);
    return ClienteViewModel.toHttp(cliente);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Atualizar cliente' })
  async save(@Param('id') id: string, @Body() body: SaveClienteBody) {
    const parsed = saveClienteSchema.parse(body);
    const { cliente } = await this.saveCliente.execute(id, parsed);
    return ClienteViewModel.toHttp(cliente);
  }
}
