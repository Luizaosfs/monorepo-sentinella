import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { z } from 'zod';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import {
  PaginationProps,
  paginationSchema,
} from '@shared/dtos/pagination-body';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Public, Roles } from '@/decorators/roles.decorator';

import {
  CreateClienteBody,
  createClienteSchema,
} from './dtos/create-cliente.body';
import {
  FilterClienteInput,
  filterClienteSchema,
} from './dtos/filter-cliente.input';
import { SaveClienteBody, saveClienteSchema } from './dtos/save-cliente.body';
import { BuscarClientePorCidadePublico } from './use-cases/buscar-cliente-por-cidade-publico';
import { CreateCliente } from './use-cases/create-cliente';
import { FilterCliente } from './use-cases/filter-cliente';
import { GetCliente } from './use-cases/get-cliente';
import {
  UpdateIntegracaoMetaBody,
  updateIntegracaoMetaSchema,
  UpsertIntegracaoBody,
  upsertIntegracaoSchema,
} from './dtos/integracao.body';
import { GetIntegracaoApiKey } from './use-cases/get-integracao-api-key';
import { GetIntegracoes } from './use-cases/get-integracoes';
import { PaginationCliente } from './use-cases/pagination-cliente';
import { ResolverPorCoordenada } from './use-cases/resolver-por-coordenada';
import { SaveCliente } from './use-cases/save-cliente';
import { TestarIntegracao } from './use-cases/testar-integracao';
import { UpdateIntegracaoMeta } from './use-cases/update-integracao-meta';
import { UpsertIntegracao } from './use-cases/upsert-integracao';
import { ClienteViewModel } from './view-model/cliente';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Clientes')
@Controller('clientes')
export class ClienteController {
  constructor(
    private buscarClientePorCidadePublico: BuscarClientePorCidadePublico,
    private createCliente: CreateCliente,
    private filterCliente: FilterCliente,
    private getCliente: GetCliente,
    private paginationCliente: PaginationCliente,
    private saveCliente: SaveCliente,
    private resolverPorCoordenada: ResolverPorCoordenada,
    private getIntegracaoApiKey: GetIntegracaoApiKey,
    private getIntegracoesUc: GetIntegracoes,
    private upsertIntegracaoUc: UpsertIntegracao,
    private updateIntegracaoMetaUc: UpdateIntegracaoMeta,
    private testarIntegracaoUc: TestarIntegracao,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('resolver-coordenada')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Resolve cliente pelos bounds que contÃªm o ponto lat/lng' })
  async resolverCoordenada(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const parsed = z.object({ lat: z.coerce.number(), lng: z.coerce.number() }).parse({ lat, lng });
    const { cliente } = await this.resolverPorCoordenada.execute(parsed.lat, parsed.lng);
    return cliente;
  }

  @Get('integracoes/:id/api-key')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Busca api_key de uma integraÃ§Ã£o do cliente' })
  async getApiKey(@Param('id') id: string) {
    const { integracao } = await this.getIntegracaoApiKey.execute(id);
    return integracao;
  }

  @Get('integracoes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar integraÃ§Ãµes do cliente (sem api_key)' })
  async getIntegracoes() {
    const clienteId = this.req['tenantId'] as string;
    return this.getIntegracoesUc.execute(clienteId);
  }

  @Post('integracoes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar ou atualizar integraÃ§Ã£o do cliente (upsert por tipo)' })
  async upsertIntegracao(@Body() body: UpsertIntegracaoBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = upsertIntegracaoSchema.parse(body);
    return this.upsertIntegracaoUc.execute(clienteId, parsed);
  }

  @Put('integracoes/:id/meta')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar metadados de uma integraÃ§Ã£o (sem alterar api_key)' })
  async updateIntegracaoMeta(@Param('id') id: string, @Body() body: UpdateIntegracaoMetaBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = updateIntegracaoMetaSchema.parse(body);
    return this.updateIntegracaoMetaUc.execute(id, clienteId, parsed);
  }

  @Post('integracoes/testar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Testar conectividade da integraÃ§Ã£o ativa do cliente' })
  async testarIntegracao() {
    const clienteId = this.req['tenantId'] as string;
    return this.testarIntegracaoUc.execute(clienteId);
  }

  @Get('por-cidade')
  @Public()
  @ApiOperation({ summary: 'Buscar cliente por cidade — portal cidadão (sem autenticação)' })
  async porCidade(@Query('cidade') cidade: string) {
    return this.buscarClientePorCidadePublico.execute(cidade ?? '');
  }

  @Get('resolver-coordenada-cidadao')
  @Public()
  @ApiOperation({ summary: 'Resolver cliente por coordenada — portal cidadão (sem autenticação)' })
  async resolverCoordenadaCidadao(@Query('lat') lat: string, @Query('lng') lng: string) {
    const parsed = z.object({ lat: z.coerce.number(), lng: z.coerce.number() }).parse({ lat, lng });
    try {
      const { cliente } = await this.resolverPorCoordenada.execute(parsed.lat, parsed.lng);
      return { id: cliente.id, nome: cliente.nome, cidade: cliente.cidade, uf: cliente.uf, slug: cliente.slug, metodo: 'bounds' };
    } catch {
      return null;
    }
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
  @ApiOperation({ summary: 'Listar clientes com paginaÃ§Ã£o' })
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

  @Get('me')
  @Roles('supervisor', 'agente', 'notificador')
  @ApiOperation({ summary: 'Retorna o cliente vinculado ao usuÃ¡rio autenticado' })
  async getMyCliente(@Req() req: Request) {
    const user = req['user'] as AuthenticatedUser;
    if (!user.clienteId) return null;
    const { cliente } = await this.getCliente.execute(user.clienteId);
    return ClienteViewModel.toHttp(cliente);
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

