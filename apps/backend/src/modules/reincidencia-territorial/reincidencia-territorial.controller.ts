import { Controller, Get, Inject, Query } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Roles } from '@/decorators/roles.decorator';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { GetReincidenciaBairrosUc } from './use-cases/get-reincidencia-bairros';
import { GetReincidenciaImoveisUc } from './use-cases/get-reincidencia-imoveis';
import { GetReincidenciaQuarteiroesuUc } from './use-cases/get-reincidencia-quarteiroes';
import { GetResumoReincidenciaUc } from './use-cases/get-resumo-reincidencia';

@ApiTags('Reincidência Territorial')
@Controller('reincidencia-territorial')
@Roles('supervisor')
export class ReincidenciaTerritorialController {
  constructor(
    private getResumo: GetResumoReincidenciaUc,
    private getImoveis: GetReincidenciaImoveisUc,
    private getQuarteiroes: GetReincidenciaQuarteiroesuUc,
    private getBairros: GetReincidenciaBairrosUc,
    @Inject(REQUEST) private req: Request,
  ) {}

  @Get('resumo')
  @ApiOperation({ summary: 'Resumo de reincidência territorial — KPIs por período' })
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  resumo(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.getResumo.execute(clienteId, dataInicio, dataFim);
  }

  @Get('imoveis')
  @ApiOperation({ summary: 'Imóveis reincidentes no período' })
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  imoveis(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.getImoveis.execute(clienteId, dataInicio, dataFim);
  }

  @Get('quarteiroes')
  @ApiOperation({ summary: 'Quarteirões com imóveis reincidentes no período' })
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  quarteiroes(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.getQuarteiroes.execute(clienteId, dataInicio, dataFim);
  }

  @Get('bairros')
  @ApiOperation({ summary: 'Bairros com imóveis reincidentes no período' })
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  bairros(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.getBairros.execute(clienteId, dataInicio, dataFim);
  }
}
