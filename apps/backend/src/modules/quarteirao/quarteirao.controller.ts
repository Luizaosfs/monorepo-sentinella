import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
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
  CoberturaCicloInput,
  coberturaCicloSchema,
} from './dtos/cobertura-ciclo.input';
import {
  CopiarDistribuicaoBody,
  CreateDistribuicaoBody,
  copiarDistribuicaoSchema,
  createDistribuicaoSchema,
} from './dtos/create-distribuicao.body';
import {
  CreateQuarteiraoBody,
  createQuarteiraoSchema,
} from './dtos/create-quarteirao.body';
import {
  FilterDistribuicaoInput,
  filterDistribuicaoSchema,
} from './dtos/filter-distribuicao.input';
import {
  FilterQuarteiraoInput,
  filterQuarteiraoSchema,
} from './dtos/filter-quarteirao.input';
import { CoberturaCiclo } from './use-cases/cobertura-ciclo';
import { CopiarDistribuicao } from './use-cases/copiar-distribuicao';
import { CreateDistribuicao } from './use-cases/create-distribuicao';
import { CreateQuarteirao } from './use-cases/create-quarteirao';
import { DeleteDistribuicao } from './use-cases/delete-distribuicao';
import { DeleteQuarteirao } from './use-cases/delete-quarteirao';
import { FilterDistribuicoes } from './use-cases/filter-distribuicoes';
import { FilterQuarteiroes } from './use-cases/filter-quarteiroes';
import {
  DistribuicaoQuarteiraoViewModel,
  QuarteiraoViewModel,
} from './view-model/quarteirao';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Quarteirões')
@Controller('quarteiroes')
export class QuarteiraoController {
  constructor(
    private filterQuarteiroes: FilterQuarteiroes,
    private createQuarteirao: CreateQuarteirao,
    private deleteQuarteirao: DeleteQuarteirao,
    private filterDistribuicoes: FilterDistribuicoes,
    private createDistribuicao: CreateDistribuicao,
    private copiarDistribuicao: CopiarDistribuicao,
    private coberturaCiclo: CoberturaCiclo,
    private deleteDistribuicao: DeleteDistribuicao,
  ) {}

  @Get('cobertura')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({
    summary:
      'Cobertura de quarteirões no ciclo (com e sem agente atribuído)',
  })
  async cobertura(@Query() query: CoberturaCicloInput) {
    const parsed = coberturaCicloSchema.parse(query);
    return this.coberturaCiclo.execute(parsed);
  }

  @Get('distribuicoes')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar distribuições por ciclo' })
  async listDistribuicoes(@Query() query: FilterDistribuicaoInput) {
    const parsed = filterDistribuicaoSchema.parse(query);
    const { distribuicoes } = await this.filterDistribuicoes.execute(parsed);
    return distribuicoes.map(DistribuicaoQuarteiraoViewModel.toHttp);
  }

  @Post('distribuicoes/copiar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Copiar distribuições de um ciclo para outro' })
  async copiar(@Body() body: CopiarDistribuicaoBody) {
    const parsed = copiarDistribuicaoSchema.parse(body);
    return this.copiarDistribuicao.execute(parsed);
  }

  @Post('distribuicoes')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar distribuição de quarteirão' })
  async createDistribuicaoHandler(@Body() body: CreateDistribuicaoBody) {
    const parsed = createDistribuicaoSchema.parse(body);
    const { distribuicao } = await this.createDistribuicao.execute(parsed);
    return DistribuicaoQuarteiraoViewModel.toHttp(distribuicao);
  }

  @Delete('distribuicoes/:id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Remover distribuição de quarteirão' })
  async deleteDistribuicaoHandler(@Param('id') id: string) {
    return this.deleteDistribuicao.execute(id);
  }

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar quarteirões' })
  async filter(@Query() filters: FilterQuarteiraoInput) {
    const parsed = filterQuarteiraoSchema.parse(filters);
    const { quarteiroes } = await this.filterQuarteiroes.execute(parsed);
    return quarteiroes.map(QuarteiraoViewModel.toHttp);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar quarteirão' })
  async create(@Body() body: CreateQuarteiraoBody) {
    const parsed = createQuarteiraoSchema.parse(body);
    const { quarteirao } = await this.createQuarteirao.execute(parsed);
    return QuarteiraoViewModel.toHttp(quarteirao);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Excluir quarteirão (soft delete)' })
  async delete(@Param('id') id: string) {
    return this.deleteQuarteirao.execute(id);
  }
}
