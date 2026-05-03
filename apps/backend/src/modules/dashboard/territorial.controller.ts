import { BadRequestException, Controller, Get, Inject, Query, UseInterceptors, UsePipes } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaInterceptor } from '@shared/modules/database/prisma/prisma.interceptor';
import { Request } from 'express';
import { MyZodValidationPipe } from 'src/pipes/zod-validations.pipe';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { Roles } from '@/decorators/roles.decorator';
import { dashboardTerritorialQuerySchema } from './dtos/dashboard-territorial.dto';
import { GetDashboardTerritorial } from './use-cases/get-dashboard-territorial';

@UseInterceptors(PrismaInterceptor)
@UsePipes(MyZodValidationPipe)
@ApiTags('Dashboard Territorial')
@Controller('dashboard')
export class TerritorialController {
  constructor(
    private getDashboardTerritorial: GetDashboardTerritorial,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('territorial')
  // analista_regional excluído: requireTenantId lança 403 para escopo regional (sem tenantId único).
  // Dashboard multi-município para analista_regional ficará em rota separada.
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Dashboard territorial municipal de risco e vulnerabilidade (clienteId via JWT)' })
  @ApiQuery({ name: 'dataInicio', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dataFim', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'bairro', required: false, description: 'Nome do bairro (texto livre)' })
  @ApiQuery({ name: 'regiaoId', required: false, description: 'UUID da região' })
  @ApiQuery({ name: 'prioridade', required: false, enum: ['P1', 'P2', 'P3', 'P4', 'P5'] })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'agenteId', required: false, description: 'UUID do agente' })
  territorial(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('bairro') bairro?: string,
    @Query('regiaoId') regiaoId?: string,
    @Query('prioridade') prioridade?: string,
    @Query('status') status?: string,
    @Query('agenteId') agenteId?: string,
  ) {
    // clienteId vem exclusivamente do JWT — nunca aceitar por query
    const clienteId = requireTenantId(getAccessScope(this.req));

    const result = dashboardTerritorialQuerySchema.safeParse({
      dataInicio,
      dataFim,
      bairro,
      regiaoId,
      prioridade,
      status,
      agenteId,
    });

    if (!result.success) {
      throw new BadRequestException(result.error.errors.map((e) => e.message).join(', '));
    }

    if (result.data.dataInicio && result.data.dataFim && result.data.dataFim < result.data.dataInicio) {
      throw new BadRequestException('dataFim deve ser posterior a dataInicio');
    }

    return this.getDashboardTerritorial.execute(clienteId, result.data);
  }
}
