import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

import { Roles } from '@/decorators/roles.decorator';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { GetCoberturaAgentesUc } from './use-cases/get-cobertura-agentes';
import { GetCoberturaQuarteiroesSUc } from './use-cases/get-cobertura-quarteiroes';
import { GetImoveisNuncaVisitadosUc } from './use-cases/get-imoveis-nunca-visitados';
import { GetResumoCoberturaUc } from './use-cases/get-resumo-cobertura';

@Controller('cobertura-operacional')
@Roles('supervisor')
export class CoberturaOperacionalController {
  constructor(
    private getResumo: GetResumoCoberturaUc,
    private getQuarteiroes: GetCoberturaQuarteiroesSUc,
    private getAgentes: GetCoberturaAgentesUc,
    private getImoveisNunca: GetImoveisNuncaVisitadosUc,
  ) {}

  @Get('resumo')
  resumo(@Req() req: Request) {
    const clienteId = requireTenantId(getAccessScope(req));
    return this.getResumo.execute(clienteId);
  }

  @Get('quarteiroes')
  quarteiroes(@Req() req: Request) {
    const clienteId = requireTenantId(getAccessScope(req));
    return this.getQuarteiroes.execute(clienteId);
  }

  @Get('agentes')
  agentes(@Req() req: Request) {
    const clienteId = requireTenantId(getAccessScope(req));
    return this.getAgentes.execute(clienteId);
  }

  @Get('imoveis-nunca-visitados')
  imoveisNuncaVisitados(@Req() req: Request) {
    const clienteId = requireTenantId(getAccessScope(req));
    return this.getImoveisNunca.execute(clienteId);
  }
}
