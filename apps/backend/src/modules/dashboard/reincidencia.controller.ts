import { Controller, Get, Inject, Query, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import { GetReincidenciaImoveis } from './use-cases/get-reincidencia-imoveis';
import { GetReincidenciaPorDeposito } from './use-cases/get-reincidencia-por-deposito';
import { GetReincidenciaSazonalidade } from './use-cases/get-reincidencia-sazonalidade';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Reincidência')
@Controller('dashboard/reincidencia')
export class ReincidenciaController {
  constructor(
    private getReincidenciaImoveis: GetReincidenciaImoveis,
    private getReincidenciaPorDeposito: GetReincidenciaPorDeposito,
    private getReincidenciaSazonalidade: GetReincidenciaSazonalidade,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('imoveis')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Imóveis com padrão de reincidência' })
  imoveis() {
    return this.getReincidenciaImoveis.execute(this.req['tenantId'] as string);
  }

  @Get('por-deposito')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Tipos de depósito que mais reincidem' })
  porDeposito() {
    return this.getReincidenciaPorDeposito.execute(this.req['tenantId'] as string);
  }

  @Get('sazonalidade')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Padrão sazonal de reincidência' })
  sazonalidade() {
    return this.getReincidenciaSazonalidade.execute(this.req['tenantId'] as string);
  }

  @Get('historico-ciclos')
  @Roles('admin', 'supervisor', 'agente', 'analista_regional')
  @ApiOperation({ summary: 'Histórico de focos por ciclo de um imóvel' })
  historicoCiclos(@Query('imovelId') imovelId: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        ciclo,
        COUNT(*) AS focos_total,
        COUNT(*) FILTER (WHERE status = 'resolvido') AS focos_resolvidos,
        COUNT(*) FILTER (WHERE foco_anterior_id IS NOT NULL) AS focos_reincidentes,
        MIN(suspeita_em) AS primeiro_foco_ciclo,
        MAX(suspeita_em) AS ultimo_foco_ciclo
      FROM focos_risco
      WHERE imovel_id = ${imovelId}::uuid
        AND cliente_id = ${clienteId}::uuid
        AND deleted_at IS NULL
      GROUP BY ciclo
      ORDER BY ciclo DESC NULLS LAST
    `);
  }
}
