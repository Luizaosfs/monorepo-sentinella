import {
  Controller,
  Get,
  Inject,
  Param,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import { CountAtivasByCliente } from './use-cases/count-ativas-by-cliente';
import { ListAtivasByCliente } from './use-cases/list-ativas-by-cliente';
import { ListItensByRecorrencia } from './use-cases/list-itens-by-recorrencia';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Recorrências')
@Controller('recorrencias')
export class RecorrenciasController {
  constructor(
    private listAtivasUC: ListAtivasByCliente,
    private countAtivasUC: CountAtivasByCliente,
    private listItensUC: ListItensByRecorrencia,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar recorrências ativas (≥2 focos em 30 dias por endereço)' })
  listAtivas() {
    const clienteId = this.req['tenantId'] as string;
    return this.listAtivasUC.execute(clienteId);
  }

  @Get('count')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Contar recorrências ativas' })
  async countAtivas() {
    const clienteId = this.req['tenantId'] as string;
    const total = await this.countAtivasUC.execute(clienteId);
    return { total };
  }

  @Get(':id/itens')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Itens de uma recorrência (deprecated — retorna [])' })
  listItens(@Param('id') id: string) {
    return this.listItensUC.execute(id);
  }
}
