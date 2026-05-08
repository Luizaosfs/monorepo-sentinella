import {
  Controller,
  Get,
  Inject,
  Post,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

import { GerarOperacaoInicial } from './use-cases/gerar-operacao-inicial';
import { GetStatusImplantacao } from './use-cases/get-status-implantacao';
import { IniciarImplantacao } from './use-cases/iniciar-implantacao';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Implantação Operacional')
@Controller('implantacao-operacional')
export class ImplantacaoOperacionalController {
  constructor(
    private getStatusImplantacao: GetStatusImplantacao,
    private iniciarImplantacao: IniciarImplantacao,
    private gerarOperacaoInicial: GerarOperacaoInicial,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('status')
  @Roles('supervisor')
  @ApiOperation({ summary: 'Diagnóstico operacional do município — checklist de implantação' })
  async status() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.getStatusImplantacao.execute(clienteId);
  }

  @Post('iniciar')
  @Roles('supervisor')
  @ApiOperation({ summary: 'Valida pré-requisitos e cria planejamento inicial se necessário' })
  async iniciar() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    await this.iniciarImplantacao.execute(clienteId);
    return this.getStatusImplantacao.execute(clienteId);
  }

  @Post('gerar-operacao-inicial')
  @Roles('supervisor')
  @ApiOperation({ summary: 'Gera operação inicial — valida pré-requisitos e ativa planejamento' })
  async gerarOperacao() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.gerarOperacaoInicial.execute(clienteId);
  }
}
