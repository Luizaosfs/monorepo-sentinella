import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { RelatorioGerado } from '../entities/dashboard';
import { RelatorioAnaliticoBody } from '../dtos/dashboard-analytics.input';
import { DashboardReadRepository } from '../repositories/dashboard-read.repository';
import { DashboardWriteRepository } from '../repositories/dashboard-write.repository';
import { GetAnaliticoResumo } from './get-analitico-resumo';
import { GetAnaliticoRiscoTerritorial } from './get-analitico-risco-territorial';
import { GetAnaliticoVulnerabilidade } from './get-analitico-vulnerabilidade';
import { GetAnaliticoAlertaSaude } from './get-analitico-alerta-saude';
import { GetAnaliticoResultadoOperacional } from './get-analitico-resultado-operacional';
import { GetAnaliticoImoveisCriticos } from './get-analitico-imoveis-criticos';

@Injectable()
export class GerarRelatorioAnalitico {
  constructor(
    private readRepository: DashboardReadRepository,
    private writeRepository: DashboardWriteRepository,
    private prisma: PrismaService,
    private getResumoUc: GetAnaliticoResumo,
    private getRiscoTerritorialUc: GetAnaliticoRiscoTerritorial,
    private getVulnerabilidadeUc: GetAnaliticoVulnerabilidade,
    private getAlertaSaudeUc: GetAnaliticoAlertaSaude,
    private getResultadoOperacionalUc: GetAnaliticoResultadoOperacional,
    private getImoveisCriticosUc: GetAnaliticoImoveisCriticos,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: RelatorioAnaliticoBody): Promise<{ relatorio: RelatorioGerado }> {
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as AuthenticatedUser).id;

    const [
      liraa,
      comparativo,
      scoreRegioes,
      resumo,
      riscoTerritorial,
      vulnerabilidade,
      alertaSaude,
      resultadoOperacional,
      imoveisCriticos,
      cliente,
    ] = await Promise.all([
      this.readRepository.calcularLiraa(clienteId, input.ciclo),
      this.readRepository.comparativoAgentes(clienteId, input.ciclo),
      this.readRepository.scoreSurtoRegioes(clienteId),
      this.getResumoUc.execute(clienteId),
      this.getRiscoTerritorialUc.execute(clienteId),
      this.getVulnerabilidadeUc.execute(clienteId),
      this.getAlertaSaudeUc.execute(clienteId),
      this.getResultadoOperacionalUc.execute(clienteId),
      this.getImoveisCriticosUc.execute(clienteId),
      this.prisma.client.clientes.findUnique({
        where: { id: clienteId },
        select: { nome: true },
      }),
    ]);

    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    const payload = {
      geradoEm: new Date().toISOString(),
      ciclo: input.ciclo ?? null,
      meta: {
        municipio: cliente?.nome ?? '—',
        periodo_inicio: toDateStr(input.periodoInicio),
        periodo_fim: toDateStr(input.periodoFim),
      },
      resumo,
      risco_territorial: riscoTerritorial,
      vulnerabilidade,
      alerta_saude: alertaSaude,
      resultado_operacional: resultadoOperacional,
      imoveis_criticos: imoveisCriticos,
      liraa,
      comparativoAgentes: comparativo,
      scoreSurtoRegioes: scoreRegioes,
    };

    const entity = new RelatorioGerado(
      {
        clienteId,
        geradoPor: userId,
        periodoInicio: input.periodoInicio,
        periodoFim: input.periodoFim,
        payload,
      },
      {},
    );

    const relatorio = await this.writeRepository.createRelatorio(entity);
    return { relatorio };
  }
}
