import {
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import { CnesEmAndamento } from './use-cases/cnes-em-andamento';
import { ListarControleCnes } from './use-cases/listar-controle-cnes';
import { ListarLogCnes } from './use-cases/listar-log-cnes';
import { SincronizarCnes } from './use-cases/sincronizar-cnes';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('CNES Sync')
@Controller('cnes')
export class CnesController {
  constructor(
    private sincronizar: SincronizarCnes,
    private listarControle: ListarControleCnes,
    private listarLog: ListarLogCnes,
    private emAndamento: CnesEmAndamento,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Post('sincronizar')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Disparar sincronização manual CNES para o cliente' })
  async sincronizarManual() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.sincronizar.execute(clienteId);
  }

  @Get('controle')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar registros de controle de sincronização CNES' })
  async controle() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.listarControle.execute(clienteId);
  }

  @Get('log')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Listar logs de sincronização CNES' })
  async log(@Query('controleId') controleId?: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.listarLog.execute(clienteId, controleId);
  }

  @Get('em-andamento')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Verifica se há sincronização CNES em andamento para o cliente' })
  async verificarEmAndamento() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.emAndamento.execute(clienteId);
  }
}
