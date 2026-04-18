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
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreateVistoriaBody,
  createVistoriaSchema,
} from './dtos/create-vistoria.body';
import {
  CreateVistoriaCompletaBody,
  createVistoriaCompletaSchema,
} from './dtos/create-vistoria-completa.body';
import {
  FilterVistoriaQuery,
  filterVistoriaSchema,
} from './dtos/filter-vistoria.input';
import {
  SaveVistoriaBody,
  saveVistoriaSchema,
} from './dtos/save-vistoria.body';
import { CountVistoria } from './use-cases/count-vistoria';
import { CreateVistoria } from './use-cases/create-vistoria';
import { CreateVistoriaCompleta } from './use-cases/create-vistoria-completa';
import { FilterVistoria } from './use-cases/filter-vistoria';
import { GetVistoria } from './use-cases/get-vistoria';
import { PaginationVistoria } from './use-cases/pagination-vistoria';
import { SaveVistoria } from './use-cases/save-vistoria';
import { VistoriaViewModel } from './view-model/vistoria';

@UseGuards(TenantGuard)
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
    private paginationVistoria: PaginationVistoria,
    private saveVistoria: SaveVistoria,
    private countVistoria: CountVistoria,
  ) {}

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
    const { vistoria } = await this.getVistoria.execute(id);
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

  @Put(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Atualizar vistoria' })
  async save(@Param('id') id: string, @Body() body: SaveVistoriaBody) {
    const parsed = saveVistoriaSchema.parse(body);
    const { vistoria } = await this.saveVistoria.execute(id, parsed);
    return VistoriaViewModel.toHttp(vistoria);
  }
}
