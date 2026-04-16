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
  CreateRegiaoBody,
  createRegiaoSchema,
} from './dtos/create-regiao.body';
import {
  FilterRegiaoInput,
  filterRegiaoSchema,
} from './dtos/filter-regiao.input';
import { SaveRegiaoBody, saveRegiaoSchema } from './dtos/save-regiao.body';
import { CreateRegiao } from './use-cases/create-regiao';
import { FilterRegiao } from './use-cases/filter-regiao';
import { GetRegiao } from './use-cases/get-regiao';
import { PaginationRegiao } from './use-cases/pagination-regiao';
import { SaveRegiao } from './use-cases/save-regiao';
import { RegiaoViewModel } from './view-model/regiao';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Regiões')
@Controller('regioes')
export class RegiaoController {
  constructor(
    private createRegiao: CreateRegiao,
    private filterRegiao: FilterRegiao,
    private getRegiao: GetRegiao,
    private paginationRegiao: PaginationRegiao,
    private saveRegiao: SaveRegiao,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar regiões com filtros' })
  async filter(@Query() filters: FilterRegiaoInput) {
    const parsed = filterRegiaoSchema.parse(filters);
    const { regioes } = await this.filterRegiao.execute(parsed);
    return regioes.map(RegiaoViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar regiões com paginação' })
  async pagination(
    @Query() filters: FilterRegiaoInput,
    @Query() pagination: PaginationProps,
  ) {
    const parsedFilters = filterRegiaoSchema.parse(filters);
    const parsedPagination = paginationSchema.parse(pagination);
    const result = await this.paginationRegiao.execute(
      parsedFilters,
      parsedPagination,
    );
    return {
      items: result.items.map(RegiaoViewModel.toHttp),
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar região por ID' })
  async findById(@Param('id') id: string) {
    const { regiao } = await this.getRegiao.execute(id);
    return RegiaoViewModel.toHttp(regiao);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar região' })
  async create(@Body() body: CreateRegiaoBody) {
    const parsed = createRegiaoSchema.parse(body);
    const { regiao } = await this.createRegiao.execute(parsed);
    return RegiaoViewModel.toHttp(regiao);
  }

  @Put(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar região' })
  async save(@Param('id') id: string, @Body() body: SaveRegiaoBody) {
    const parsed = saveRegiaoSchema.parse(body);
    const { regiao } = await this.saveRegiao.execute(id, parsed);
    return RegiaoViewModel.toHttp(regiao);
  }
}
