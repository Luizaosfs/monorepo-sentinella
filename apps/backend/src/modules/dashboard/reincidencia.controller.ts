import { Controller, Get, Inject, Query, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Reincidência')
@Controller('dashboard/reincidencia')
export class ReincidenciaController {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('imoveis')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Imóveis com padrão de reincidência (v_imoveis_reincidentes)' })
  async imoveis() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_imoveis_reincidentes WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('por-deposito')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Tipos de depósito que mais reincidem (v_reincidencia_por_deposito)' })
  async porDeposito() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_reincidencia_por_deposito WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('sazonalidade')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Padrão sazonal de reincidência (v_reincidencia_sazonalidade)' })
  async sazonalidade() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_reincidencia_sazonalidade WHERE cliente_id = ${clienteId}::uuid ORDER BY ciclo DESC`,
    );
  }

  @Get('historico-ciclos')
  @Roles('admin', 'supervisor', 'agente', 'analista_regional')
  @ApiOperation({ summary: 'Histórico de focos por ciclo de um imóvel' })
  async historicoCiclos(@Query('imovelId') imovelId: string) {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`
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
      `,
    );
  }
}
