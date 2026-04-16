import { Injectable } from '@nestjs/common';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';
import { PluvioWriteRepository, SlaInput } from '../repositories/pluvio-write.repository';

const SLA_POR_CLASSIFICACAO: Record<string, { prioridade: string; slaHoras: number }> = {
  alto: { prioridade: 'alta', slaHoras: 48 },
  critico: { prioridade: 'critica', slaHoras: 24 },
};

@Injectable()
export class GerarSlasRun {
  constructor(
    private readRepository: PluvioReadRepository,
    private writeRepository: PluvioWriteRepository,
  ) {}

  async execute(runId: string): Promise<{ criados: number }> {
    const run = await this.readRepository.findRunById(runId);
    if (!run) throw PluvioException.notFound();

    const items = await this.readRepository.findItemsByRunId(runId);

    const slas: SlaInput[] = items
      .filter((item) => item.nivelRisco in SLA_POR_CLASSIFICACAO)
      .map((item) => ({
        clienteId: run.clienteId,
        itemId: item.id!,
        ...(SLA_POR_CLASSIFICACAO[item.nivelRisco as keyof typeof SLA_POR_CLASSIFICACAO]),
      }));

    const criados = await this.writeRepository.createSlasBulk(slas);
    return { criados };
  }
}
