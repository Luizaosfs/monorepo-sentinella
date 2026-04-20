import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreatePlanoAcaoBody,
  createPlanoAcaoSchema,
} from './dtos/create-plano-acao.body';
import {
  FilterPlanoAcaoAllQuery,
  FilterPlanoAcaoQuery,
  filterPlanoAcaoAllSchema,
  filterPlanoAcaoSchema,
} from './dtos/filter-plano-acao.input';
import { SavePlanoAcaoBody, savePlanoAcaoSchema } from './dtos/save-plano-acao.body';
import { CreatePlanoAcao } from './use-cases/create-plano-acao';
import { DeletePlanoAcao } from './use-cases/delete-plano-acao';
import { FilterAllPlanoAcao } from './use-cases/filter-all';
import { FilterPlanoAcao } from './use-cases/filter-plano-acao';
import { SavePlanoAcao } from './use-cases/save-plano-acao';
import { PlanoAcaoViewModel } from './view-model/plano-acao';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Plano de ação (catálogo)')
@Controller('plano-acao')
export class PlanoAcaoController {
  constructor(
    private filterPlanoAcao: FilterPlanoAcao,
    private filterAllPlanoAcao: FilterAllPlanoAcao,
    private createPlanoAcao: CreatePlanoAcao,
    private savePlanoAcao: SavePlanoAcao,
    private deletePlanoAcao: DeletePlanoAcao,
  ) {}

  @Get('all')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Listar catálogo incluindo inativos (admin/supervisor)',
  })
  async filterAll(@Query() filters: FilterPlanoAcaoAllQuery) {
    const parsed = filterPlanoAcaoAllSchema.parse(filters);
    const { planosAcao } = await this.filterAllPlanoAcao.execute(parsed);
    return planosAcao.map(PlanoAcaoViewModel.toHttp);
  }

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary: 'Listar catálogo (apenas ativos, ordenado por ordem)',
  })
  async filter(@Query() filters: FilterPlanoAcaoQuery) {
    const parsed = filterPlanoAcaoSchema.parse(filters);
    const { planosAcao } = await this.filterPlanoAcao.execute(parsed);
    return planosAcao.map(PlanoAcaoViewModel.toHttp);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar item do catálogo de plano de ação' })
  async create(@Body() body: CreatePlanoAcaoBody) {
    const parsed = createPlanoAcaoSchema.parse(body);
    const { planoAcao } = await this.createPlanoAcao.execute(parsed);
    return PlanoAcaoViewModel.toHttp(planoAcao);
  }

  @Put(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar item do catálogo' })
  async save(@Param('id') id: string, @Body() body: SavePlanoAcaoBody) {
    const parsed = savePlanoAcaoSchema.parse(body);
    const { planoAcao } = await this.savePlanoAcao.execute(id, parsed);
    return PlanoAcaoViewModel.toHttp(planoAcao);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover item do catálogo' })
  async remove(@Param('id') id: string) {
    return this.deletePlanoAcao.execute(id);
  }
}
