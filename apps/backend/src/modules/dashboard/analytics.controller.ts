import { Controller, Get, Inject, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import {
  getAccessScope,
  getClienteIdsPermitidos,
} from '@/shared/security/access-scope.helpers';
import { GetRegionalKpi } from './use-cases/get-regional-kpi';
import { GetRegionalSla } from './use-cases/get-regional-sla';
import { GetRegionalUso } from './use-cases/get-regional-uso';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Analytics')
@Controller('analytics/regional')
export class AnalyticsController {
  constructor(
    private getRegionalKpi: GetRegionalKpi,
    private getRegionalSla: GetRegionalSla,
    private getRegionalUso: GetRegionalUso,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('kpi')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'KPI agregado por município' })
  kpi() {
    const scope = getAccessScope(this.req);
    return this.getRegionalKpi.execute(getClienteIdsPermitidos(scope));
  }

  @Get('sla')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'SLA por município' })
  sla() {
    const scope = getAccessScope(this.req);
    return this.getRegionalSla.execute(getClienteIdsPermitidos(scope));
  }

  @Get('uso')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Uso do sistema por município' })
  uso() {
    const scope = getAccessScope(this.req);
    return this.getRegionalUso.execute(getClienteIdsPermitidos(scope));
  }

  @Get('comparativo-municipios')
  @Roles('admin')
  @ApiOperation({ summary: 'Comparativo KPIs entre todos os municípios' })
  comparativoMunicipios() {
    return this.getRegionalKpi.executeAll();
  }
}
