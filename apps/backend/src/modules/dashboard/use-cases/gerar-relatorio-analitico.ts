import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { RelatorioGerado } from '../entities/dashboard';
import { RelatorioAnaliticoBody } from '../dtos/dashboard-analytics.input';
import { DashboardReadRepository } from '../repositories/dashboard-read.repository';
import { DashboardWriteRepository } from '../repositories/dashboard-write.repository';

@Injectable()
export class GerarRelatorioAnalitico {
  constructor(
    private readRepository: DashboardReadRepository,
    private writeRepository: DashboardWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(
    input: RelatorioAnaliticoBody,
  ): Promise<{ relatorio: RelatorioGerado }> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;
    const userId = this.req['userId'] as string | undefined;

    const [liraa, comparativo, scoreRegioes] = await Promise.all([
      this.readRepository.calcularLiraa(clienteId, input.ciclo),
      this.readRepository.comparativoAgentes(clienteId, input.ciclo),
      this.readRepository.scoreSurtoRegioes(clienteId),
    ]);

    const payload = {
      geradoEm: new Date().toISOString(),
      ciclo: input.ciclo ?? null,
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
