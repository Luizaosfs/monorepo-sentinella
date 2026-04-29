import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { Roles } from '@/decorators/roles.decorator';

import {
  CancelarReinspecaoBody,
  CreateReinspecaoBody,
  cancelarReinspecaoSchema,
  createReinspecaoSchema,
} from './dtos/create-reinspecao.body';
import {
  FilterReinspecaoInput,
  filterReinspecaoSchema,
} from './dtos/filter-reinspecao.input';
import {
  ReagendarReinspecaoBody,
  reagendarReinspecaoSchema,
} from './dtos/reagendar-reinspecao.body';
import {
  ResultadoReinspecaoBody,
  resultadoReinspecaoSchema,
} from './dtos/resultado-reinspecao.body';
import { CancelarReinspecao } from './use-cases/cancelar';
import { CountReinspecoesPendentes } from './use-cases/count-pendentes';
import { CriarManual } from './use-cases/criar-manual';
import { FilterReinspecoes } from './use-cases/filter-reinspecoes';
import { GetReinspecao } from './use-cases/get-reinspecao';
import { MarcarVencidas } from './use-cases/marcar-vencidas';
import { ReagendarReinspecao } from './use-cases/reagendar';
import { RegistrarResultadoReinspecao } from './use-cases/registrar-resultado';
import { ReinspecaoViewModel } from './view-model/reinspecao';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Reinspeções')
@Controller('reinspecoes')
export class ReinspecaoController {
  constructor(
    private filterReinspecoes: FilterReinspecoes,
    private countPendentes: CountReinspecoesPendentes,
    private criarManual: CriarManual,
    private cancelarReinspecao: CancelarReinspecao,
    private reagendarReinspecao: ReagendarReinspecao,
    private registrarResultadoReinspecao: RegistrarResultadoReinspecao,
    private marcarVencidas: MarcarVencidas,
    private getReinspecao: GetReinspecao,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Post('marcar-vencidas')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary:
      'Marcar como vencidas as reinspeções pendentes com data prevista no passado',
  })
  async marcarVencidasHandler() {
    return this.marcarVencidas.execute();
  }

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar reinspeções programadas' })
  async filter(@Query() filters: FilterReinspecaoInput) {
    const parsed = filterReinspecaoSchema.parse(filters);
    // MT-02: clienteId SEMPRE vem do TenantGuard, nunca da query diretamente
    parsed.clienteId = getAccessScope(this.req).tenantId ?? undefined;
    const { reinspecoes } = await this.filterReinspecoes.execute(parsed);
    return reinspecoes.map(ReinspecaoViewModel.toHttp);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar reinspeção manual' })
  async create(@Body() body: CreateReinspecaoBody) {
    const parsed = createReinspecaoSchema.parse(body);
    const { reinspecao } = await this.criarManual.execute(parsed);
    return ReinspecaoViewModel.toHttp(reinspecao);
  }

  @Get('count')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Contar reinspeções pendentes/vencidas (do agente ou do cliente)' })
  async count(@Query('agenteId') agenteId?: string) {
    // MT-03: clienteId vem do TenantGuard, não de query param
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.countPendentes.execute(clienteId, agenteId);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Buscar reinspeção por id' })
  async getById(@Param('id') id: string) {
    const { reinspecao } = await this.getReinspecao.execute(id);
    return ReinspecaoViewModel.toHttp(reinspecao);
  }

  @Patch(':id/cancelar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Cancelar reinspeção pendente' })
  async cancelar(
    @Param('id') id: string,
    @Body() body: CancelarReinspecaoBody,
  ) {
    const parsed = cancelarReinspecaoSchema.parse(body);
    const { reinspecao } = await this.cancelarReinspecao.execute(id, parsed);
    return ReinspecaoViewModel.toHttp(reinspecao);
  }

  @Patch(':id/reagendar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Reagendar data prevista (mantém pendente)' })
  async reagendar(
    @Param('id') id: string,
    @Body() body: ReagendarReinspecaoBody,
  ) {
    const parsed = reagendarReinspecaoSchema.parse(body);
    const { reinspecao } = await this.reagendarReinspecao.execute(id, parsed);
    return ReinspecaoViewModel.toHttp(reinspecao);
  }

  @Patch(':id/resultado')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Registrar resultado (conclui como realizada)' })
  async resultado(
    @Param('id') id: string,
    @Body() body: ResultadoReinspecaoBody,
  ) {
    const parsed = resultadoReinspecaoSchema.parse(body);
    const { reinspecao } =
      await this.registrarResultadoReinspecao.execute(id, parsed);
    return ReinspecaoViewModel.toHttp(reinspecao);
  }
}
