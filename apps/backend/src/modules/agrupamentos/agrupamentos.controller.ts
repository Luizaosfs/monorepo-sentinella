import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  AddAgrupamentoClienteBody,
  addAgrupamentoClienteSchema,
  CreateAgrupamentoBody,
  createAgrupamentoSchema,
  UpdateAgrupamentoBody,
  updateAgrupamentoSchema,
} from './dtos/agrupamentos.body';
import { AddAgrupamentoCliente } from './use-cases/add-agrupamento-cliente';
import { CreateAgrupamento } from './use-cases/create-agrupamento';
import { FilterAgrupamentos } from './use-cases/filter-agrupamentos';
import { ListAgrupamentoClientes } from './use-cases/list-agrupamento-clientes';
import { RemoveAgrupamentoCliente } from './use-cases/remove-agrupamento-cliente';
import { UpdateAgrupamento } from './use-cases/update-agrupamento';

// Agrupamentos são platform-level: sem cliente_id próprio.
// Segurança via @Roles('admin') — IDOR não se aplica (nenhum tenant "dono").
@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Agrupamentos')
@Controller('agrupamentos')
export class AgrupamentosController {
  constructor(
    private agrupamentosFilter: FilterAgrupamentos,
    private agrupamentosCreate: CreateAgrupamento,
    private agrupamentosUpdate: UpdateAgrupamento,
    private agrupamentoClientesList: ListAgrupamentoClientes,
    private agrupamentoClienteAdd: AddAgrupamentoCliente,
    private agrupamentoClienteRemove: RemoveAgrupamentoCliente,
  ) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar agrupamentos regionais ativos' })
  async list() {
    return this.agrupamentosFilter.execute();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Criar agrupamento regional' })
  async create(@Body() body: CreateAgrupamentoBody) {
    const parsed = createAgrupamentoSchema.parse(body);
    return this.agrupamentosCreate.execute(parsed);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Atualizar agrupamento regional' })
  async update(@Param('id') id: string, @Body() body: UpdateAgrupamentoBody) {
    const parsed = updateAgrupamentoSchema.parse(body);
    return this.agrupamentosUpdate.execute(id, parsed);
  }

  @Get(':id/clientes')
  @Roles('admin')
  @ApiOperation({ summary: 'Listar clientes de um agrupamento' })
  async listClientes(@Param('id') id: string) {
    return this.agrupamentoClientesList.execute(id);
  }

  @Post(':id/clientes')
  @Roles('admin')
  @ApiOperation({ summary: 'Adicionar cliente a agrupamento' })
  async addCliente(@Param('id') id: string, @Body() body: AddAgrupamentoClienteBody) {
    const parsed = addAgrupamentoClienteSchema.parse(body);
    return this.agrupamentoClienteAdd.execute(id, parsed.clienteId);
  }

  @Delete(':id/clientes/:clienteId')
  @Roles('admin')
  @ApiOperation({ summary: 'Remover cliente de agrupamento' })
  async removeCliente(@Param('id') id: string, @Param('clienteId') clienteId: string) {
    await this.agrupamentoClienteRemove.execute(id, clienteId);
    return { removed: true };
  }
}
