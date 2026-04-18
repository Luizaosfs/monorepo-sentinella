import {
  Body,
  Controller,
  Get,
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
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import { AbrirCicloBody, abrirCicloSchema } from './dtos/abrir-ciclo.body';
import { CreateCicloBody, createCicloSchema } from './dtos/create-ciclo.body';
import { FecharCicloBody, fecharCicloSchema } from './dtos/fechar-ciclo.body';
import { FilterCicloInput, filterCicloSchema } from './dtos/filter-ciclo.input';
import { SaveCicloBody, saveCicloSchema } from './dtos/save-ciclo.body';
import { AbrirCiclo } from './use-cases/abrir-ciclo';
import { AtivarCiclo } from './use-cases/ativar-ciclo';
import { CreateCiclo } from './use-cases/create-ciclo';
import { FecharCiclo } from './use-cases/fechar-ciclo';
import { FilterCiclo } from './use-cases/filter-ciclo';
import { GetCicloAtivo } from './use-cases/get-ciclo-ativo';
import { GetCicloProgresso } from './use-cases/get-ciclo-progresso';
import { SaveCiclo } from './use-cases/save-ciclo';
import { CicloViewModel } from './view-model/ciclo';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Ciclos')
@Controller('ciclos')
export class CicloController {
  constructor(
    private abrirCiclo: AbrirCiclo,
    private ativarCiclo: AtivarCiclo,
    private createCiclo: CreateCiclo,
    private fecharCiclo: FecharCiclo,
    private filterCiclo: FilterCiclo,
    private getCicloAtivo: GetCicloAtivo,
    private getCicloProgresso: GetCicloProgresso,
    private saveCiclo: SaveCiclo,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('ativo')
  @Roles('admin', 'supervisor', 'agente', 'notificador', 'analista_regional')
  @ApiOperation({ summary: 'Retorna o ciclo ativo do cliente com campos calculados' })
  async ativo() {
    const clienteId = this.req['tenantId'] as string;
    const { ciclo, cicloNumeroEfetivo, pctTempoDecorrido } =
      await this.getCicloAtivo.execute(clienteId);
    return ciclo ?? { cicloNumeroEfetivo, pctTempoDecorrido };
  }

  @Get('progresso')
  @Roles('admin', 'supervisor', 'agente', 'analista_regional')
  @ApiOperation({ summary: 'KPIs de progresso do ciclo ativo' })
  async progresso() {
    const clienteId = this.req['tenantId'] as string;
    const { progresso } = await this.getCicloProgresso.execute(clienteId);
    return progresso;
  }

  @Get()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar ciclos' })
  async filter(@Query() filters: FilterCicloInput) {
    const parsed = filterCicloSchema.parse(filters);
    const { ciclos } = await this.filterCiclo.execute(parsed);
    return ciclos.map(CicloViewModel.toHttp);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar ciclo' })
  async create(@Body() body: CreateCicloBody) {
    const parsed = createCicloSchema.parse(body);
    const { ciclo } = await this.createCiclo.execute(parsed);
    return CicloViewModel.toHttp(ciclo);
  }

  @Post('abrir')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Abrir ciclo bimestral (upsert + status=ativo)' })
  async abrir(@Body() body: AbrirCicloBody) {
    const parsed = abrirCicloSchema.parse(body);
    return this.abrirCiclo.execute(parsed);
  }

  @Post('fechar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Fechar ciclo bimestral com snapshot' })
  async fechar(@Body() body: FecharCicloBody) {
    const parsed = fecharCicloSchema.parse(body);
    return this.fecharCiclo.execute(parsed);
  }

  @Put(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Atualizar ciclo' })
  async save(@Param('id') id: string, @Body() body: SaveCicloBody) {
    const parsed = saveCicloSchema.parse(body);
    const { ciclo } = await this.saveCiclo.execute(id, parsed);
    return CicloViewModel.toHttp(ciclo);
  }

  @Patch(':id/ativar')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Ativar ciclo (desativa todos os outros do cliente)',
  })
  async ativar(@Param('id') id: string) {
    const { ciclo } = await this.ativarCiclo.execute(id);
    return CicloViewModel.toHttp(ciclo);
  }
}
