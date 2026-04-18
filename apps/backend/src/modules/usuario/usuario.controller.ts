import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
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
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateUsuarioBody,
  createUsuarioSchema,
} from './dtos/create-usuario.body';
import {
  FilterUsuarioInput,
  filterUsuarioSchema,
} from './dtos/filter-usuario.input';
import {
  SaveUsuarioBody,
  saveUsuarioSchema,
} from './dtos/save-usuario.body';
import { CreateUsuario } from './use-cases/create-usuario';
import { DeleteUsuario } from './use-cases/delete-usuario';
import { FilterUsuario } from './use-cases/filter-usuario';
import { GetPapeisCliente } from './use-cases/get-papeis-cliente';
import { GetUsuario } from './use-cases/get-usuario';
import { PaginationUsuario } from './use-cases/pagination-usuario';
import { SaveUsuario } from './use-cases/save-usuario';
import { UsuarioViewModel } from './view-model/usuario';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Usuários')
@Controller('usuarios')
export class UsuarioController {
  constructor(
    private createUsuario: CreateUsuario,
    private filterUsuario: FilterUsuario,
    private paginationUsuario: PaginationUsuario,
    private getPapeisCliente: GetPapeisCliente,
    private getUsuario: GetUsuario,
    private saveUsuario: SaveUsuario,
    private deleteUsuario: DeleteUsuario,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar usuários com filtros' })
  async filter(@Query() filters: FilterUsuarioInput) {
    const parsed = filterUsuarioSchema.parse(filters);
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsed.clienteId = this.req['tenantId'] as string | undefined;
    const { usuarios } = await this.filterUsuario.execute(parsed);
    return usuarios.map(UsuarioViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar usuários com paginação' })
  async pagination(
    @Query() filters: FilterUsuarioInput,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterUsuarioSchema.parse(filters);
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsedFilters.clienteId = this.req['tenantId'] as string | undefined;
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationUsuario.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(UsuarioViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get('papeis')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Lista papéis dos usuários de um cliente' })
  async getPapeis() {
    // MT-03: clienteId vem do TenantGuard, não de query param
    const clienteId = this.req['tenantId'] as string;
    const { papeis } = await this.getPapeisCliente.execute(clienteId);
    return papeis;
  }

  @Get(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  async findById(@Param('id') id: string) {
    const { usuario } = await this.getUsuario.execute(id);
    return UsuarioViewModel.toHttp(usuario);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar usuário' })
  async create(@Body() body: CreateUsuarioBody) {
    const parsed = createUsuarioSchema.parse(body);
    const { usuario } = await this.createUsuario.execute(parsed);
    return UsuarioViewModel.toHttp(usuario);
  }

  @Patch(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar usuário (nome, ativo, papeis)' })
  async update(@Param('id') id: string, @Body() body: SaveUsuarioBody) {
    const parsed = saveUsuarioSchema.parse(body);
    const { usuario } = await this.saveUsuario.execute(id, parsed);
    return UsuarioViewModel.toHttp(usuario);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desativar usuário (soft delete)' })
  async remove(@Param('id') id: string) {
    await this.deleteUsuario.execute(id);
  }
}
