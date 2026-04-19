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
@ApiTags('Dashboard Eficácia')
@Controller('dashboard/eficacia')
export class EficaciaController {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('tratamento')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Eficácia de tratamentos: taxa de não-recorrência 90d (v_eficacia_tratamento)' })
  async tratamento() {
    const clienteId = this.req['tenantId'] as string;
    return this.prisma.client.$queryRaw(
      Prisma.sql`SELECT * FROM v_eficacia_tratamento WHERE cliente_id = ${clienteId}::uuid ORDER BY taxa_eficacia_pct DESC`,
    );
  }
}
