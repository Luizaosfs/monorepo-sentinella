import { Controller, Get, Inject, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import { GetEficaciaTratamento } from './use-cases/get-eficacia-tratamento';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Eficácia')
@Controller('dashboard/eficacia')
export class EficaciaController {
  constructor(
    private getEficaciaTratamento: GetEficaciaTratamento,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('tratamento')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Eficácia de tratamentos: taxa de não-recorrência 90d' })
  tratamento() {
    return this.getEficaciaTratamento.execute(this.req['tenantId'] as string);
  }
}
