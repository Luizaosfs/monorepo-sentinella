import {
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { z } from 'zod';

import { Roles } from '@/decorators/roles.decorator';

import { ListAlertasByAgente } from './use-cases/list-alertas-by-agente';
import { ResolverAlerta } from './use-cases/resolver-alerta';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Alertas de Retorno')
@Controller('alerta-retorno')
export class AlertaRetornoController {
  constructor(
    private listByAgenteUC: ListAlertasByAgente,
    private resolverUC: ResolverAlerta,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get()
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Listar alertas de retorno do agente' })
  async listByAgente(@Query('agenteId') agenteId: string) {
    const parsedAgenteId = z.string().uuid().parse(agenteId);
    const clienteId = this.req['tenantId'] as string;
    return this.listByAgenteUC.execute(clienteId, parsedAgenteId);
  }

  @Patch(':id/resolver')
  @Roles('admin', 'supervisor', 'agente')
  @ApiOperation({ summary: 'Marcar alerta de retorno como resolvido' })
  async resolver(@Param('id') id: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.resolverUC.execute(id, clienteId);
  }
}
