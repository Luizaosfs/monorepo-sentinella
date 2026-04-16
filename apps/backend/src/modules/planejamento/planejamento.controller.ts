import {
  Body,
  Controller,
  Delete,
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
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import {
  CreatePlanejamentoBody,
  createPlanejamentoSchema,
} from './dtos/create-planejamento.body';
import {
  FilterPlanejamentoQuery,
  filterPlanejamentoSchema,
} from './dtos/filter-planejamento.input';
import {
  SavePlanejamentoBody,
  savePlanejamentoSchema,
} from './dtos/save-planejamento.body';
import { CreatePlanejamento } from './use-cases/create-planejamento';
import { DeletePlanejamento } from './use-cases/delete-planejamento';
import { FilterPlanejamento } from './use-cases/filter-planejamento';
import { GetAtivos } from './use-cases/get-ativos';
import { GetAtivosManuais } from './use-cases/get-ativos-manuais';
import { GetPlanejamento } from './use-cases/get-planejamento';
import { SavePlanejamento } from './use-cases/save-planejamento';
import { PlanejamentoViewModel } from './view-model/planejamento';

@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Planejamentos')
@Controller('planejamentos')
export class PlanejamentoController {
  constructor(
    private filterPlanejamento: FilterPlanejamento,
    private getAtivos: GetAtivos,
    private getAtivosManuais: GetAtivosManuais,
    private getPlanejamento: GetPlanejamento,
    private createPlanejamento: CreatePlanejamento,
    private savePlanejamento: SavePlanejamento,
    private deletePlanejamento: DeletePlanejamento,
  ) {}

  @Get()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar todos os planejamentos' })
  async filter(@Query() filters: FilterPlanejamentoQuery) {
    const parsed = filterPlanejamentoSchema.parse(filters);
    const { planejamentos } = await this.filterPlanejamento.execute(parsed);
    return planejamentos.map(PlanejamentoViewModel.toHttp);
  }

  @Get('ativos')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar planejamentos ativos' })
  async ativos() {
    const { planejamentos } = await this.getAtivos.execute();
    return planejamentos.map(PlanejamentoViewModel.toHttp);
  }

  @Get('ativos-manuais')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary: 'Listar planejamentos ativos com tipo_levantamento=MANUAL',
  })
  async ativosManuais() {
    const { planejamentos } = await this.getAtivosManuais.execute();
    return planejamentos.map(PlanejamentoViewModel.toHttp);
  }

  @Get(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Buscar planejamento por ID' })
  async findById(@Param('id') id: string) {
    const { planejamento } = await this.getPlanejamento.execute(id);
    return PlanejamentoViewModel.toHttp(planejamento);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar planejamento' })
  async create(@Body() body: CreatePlanejamentoBody) {
    const parsed = createPlanejamentoSchema.parse(body);
    const { planejamento } = await this.createPlanejamento.execute(parsed);
    return PlanejamentoViewModel.toHttp(planejamento);
  }

  @Put(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar planejamento' })
  async save(@Param('id') id: string, @Body() body: SavePlanejamentoBody) {
    const parsed = savePlanejamentoSchema.parse(body);
    const { planejamento } = await this.savePlanejamento.execute(id, parsed);
    return PlanejamentoViewModel.toHttp(planejamento);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Soft delete de planejamento' })
  async remove(@Param('id') id: string) {
    return this.deletePlanejamento.execute(id);
  }
}
