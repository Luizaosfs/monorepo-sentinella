import { Controller, Get, Inject, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { Roles } from '@/decorators/roles.decorator';
import { GetEficaciaTratamento } from './use-cases/get-eficacia-tratamento';

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
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Eficácia de tratamentos: taxa de não-recorrência 90d' })
  tratamento() {
    return this.getEficaciaTratamento.execute(requireTenantId(getAccessScope(this.req)));
  }
}
