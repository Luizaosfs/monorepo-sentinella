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
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PaginationProps,
  paginationSchema,
} from '@shared/dtos/pagination-body';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { z } from 'zod';

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
import { RegiaoGeocodeService } from './regiao-geocode.service';
import { BulkInsertRegioes } from './use-cases/bulk-insert-regioes';
import { CreateRegiao } from './use-cases/create-regiao';
import { DeleteRegiao } from './use-cases/delete-regiao';
import { FilterRegiao } from './use-cases/filter-regiao';
import { GetRegiao } from './use-cases/get-regiao';
import { PaginationRegiao } from './use-cases/pagination-regiao';
import { SaveRegiao } from './use-cases/save-regiao';
import { RegiaoViewModel } from './view-model/regiao';
import {
  BulkInsertRegioesBody,
  bulkInsertRegioesSchema,
} from './dtos/bulk-insert-regioes.body';

const geocodeLoteSchema = z.object({
  nomes: z.array(z.string().min(1)).min(1).max(100),
  cidade: z.string().default(''),
});

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Regiões')
@Controller('regioes')
export class RegiaoController {
  constructor(
    private createRegiao: CreateRegiao,
    private deleteRegiao: DeleteRegiao,
    private filterRegiao: FilterRegiao,
    private getRegiao: GetRegiao,
    private paginationRegiao: PaginationRegiao,
    private saveRegiao: SaveRegiao,
    private regiaoGeocodeService: RegiaoGeocodeService,
    private bulkInsertRegioesUc: BulkInsertRegioes,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente', 'notificador')
  @ApiOperation({ summary: 'Listar regiões com filtros' })
  async filter(@Query() filters: FilterRegiaoInput) {
    const parsed = filterRegiaoSchema.parse(filters);
    const { regioes } = await this.filterRegiao.execute(parsed);
    return regioes.map(RegiaoViewModel.toHttp);
  }

  @Get('pagination')
  @Roles('admin', 'supervisor', 'agente', 'notificador')
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
  @Roles('admin', 'supervisor', 'agente', 'notificador')
  @ApiOperation({ summary: 'Buscar região por ID' })
  async findById(@Param('id') id: string) {
    const { regiao } = await this.getRegiao.execute(id);
    return RegiaoViewModel.toHttp(regiao);
  }

  @Post('geocode-lote')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Geocodificar lista de nomes de regiões via Nominatim' })
  async geocodeLote(@Body() body: unknown) {
    const { nomes, cidade } = geocodeLoteSchema.parse(body);
    return this.regiaoGeocodeService.geocodeLote(nomes, cidade);
  }

  @Post('bulk-insert')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Inserir múltiplas regiões em lote (skipDuplicates)' })
  async bulkInsert(@Body() body: BulkInsertRegioesBody) {
    const clienteId = this.req['tenantId'] as string;
    const parsed = bulkInsertRegioesSchema.parse(body);
    return this.bulkInsertRegioesUc.execute(clienteId, parsed);
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

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desativar região (soft delete)' })
  async remove(@Param('id') id: string) {
    await this.deleteRegiao.execute(id);
  }
}
