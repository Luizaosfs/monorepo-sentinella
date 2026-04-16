import { Injectable } from '@nestjs/common';

import { CreateRelatorioBody } from '../dtos/create-relatorio.body';
import { RelatorioGerado } from '../entities/dashboard';
import { DashboardWriteRepository } from '../repositories/dashboard-write.repository';

@Injectable()
export class CreateRelatorio {
  constructor(private repository: DashboardWriteRepository) {}

  async execute(
    clienteId: string,
    userId: string | undefined,
    input: CreateRelatorioBody,
  ): Promise<{ relatorio: RelatorioGerado }> {
    const entity = new RelatorioGerado(
      {
        clienteId,
        geradoPor: userId,
        periodoInicio: input.periodoInicio,
        periodoFim: input.periodoFim,
        payload: input.payload ?? {},
      },
      {},
    );
    const created = await this.repository.createRelatorio(entity);
    return { relatorio: created };
  }
}
