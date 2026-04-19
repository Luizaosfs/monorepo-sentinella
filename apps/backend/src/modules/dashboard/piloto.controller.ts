import { Controller, Get, Inject, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { TenantGuard } from 'src/guards/tenant.guard';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';

import { Roles } from '@/decorators/roles.decorator';
import { GetPilotoFunilHoje } from './use-cases/get-piloto-funil-hoje';
import { GetPilotoDespachosSupervisor } from './use-cases/get-piloto-despachos-supervisor';
import { GetPilotoProdAgentes } from './use-cases/get-piloto-prod-agentes';

@UseGuards(TenantGuard)
@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Piloto')
@Controller('dashboard/piloto')
export class PilotoController {
  constructor(
    private getPilotoFunilHoje: GetPilotoFunilHoje,
    private getPilotoDespachosSupervisor: GetPilotoDespachosSupervisor,
    private getPilotoProdAgentes: GetPilotoProdAgentes,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('funil-hoje')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Funil operacional do dia' })
  funilHoje() {
    return this.getPilotoFunilHoje.execute(this.req['tenantId'] as string);
  }

  @Get('despachos-supervisor')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Produtividade de despacho por supervisor' })
  despachosSupervisor() {
    return this.getPilotoDespachosSupervisor.execute(this.req['tenantId'] as string);
  }

  @Get('prod-agentes')
  @Roles('admin', 'supervisor', 'analista_regional')
  @ApiOperation({ summary: 'Produtividade dos agentes em campo' })
  prodAgentes() {
    return this.getPilotoProdAgentes.execute(this.req['tenantId'] as string);
  }
}
