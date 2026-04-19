import { Controller, Get, Inject, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
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
@ApiTags('Dashboard Piloto')
@Controller('dashboard/piloto')
export class PilotoController {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('funil-hoje')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Funil operacional do dia (v_piloto_funil_hoje)' })
  async funilHoje() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_piloto_funil_hoje WHERE cliente_id = ${clienteId}::uuid`,
    );
  }

  @Get('despachos-supervisor')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Produtividade de despacho por supervisor (v_piloto_despachos_supervisor)' })
  async despachosSupervisor() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_piloto_despachos_supervisor WHERE cliente_id = ${clienteId}::uuid ORDER BY despachos_hoje DESC`,
    );
  }

  @Get('prod-agentes')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Produtividade dos agentes em campo (v_piloto_prod_agentes)' })
  async prodAgentes() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_piloto_prod_agentes WHERE cliente_id = ${clienteId}::uuid ORDER BY resolvidos_total DESC`,
    );
  }
}
