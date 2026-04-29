import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { AtribuirAgenteLoteInput } from '../dtos/atribuir-agente-lote.body';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class AtribuirAgenteLote {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: AtribuirAgenteLoteInput) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const userId = this.req['user']?.id as string;

    const focos = await this.readRepository.findManyByIds(
      input.focoIds,
      clienteId,
    );

    const focoMap = new Map(focos.map((f) => [f.id!, f]));

    let sucesso = 0;
    const falhas: { focoId: string; erro: string }[] = [];

    for (const focoId of input.focoIds) {
      try {
        const foco = focoMap.get(focoId);
        if (!foco) {
          falhas.push({ focoId, erro: 'Foco de risco não encontrado' });
          continue;
        }

        foco.responsavelId = input.agenteId;
        await this.writeRepository.save(foco);

        await this.writeRepository.createHistorico({
          focoRiscoId: foco.id,
          clienteId: foco.clienteId,
          statusAnterior: foco.status,
          statusNovo: foco.status,
          alteradoPor: userId,
          motivo: input.motivo ?? `Agente ${input.agenteId} atribuído em lote`,
          tipoEvento: 'atribuicao_responsavel',
        });

        sucesso++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        falhas.push({ focoId, erro: msg });
      }
    }

    return { total: input.focoIds.length, sucesso, falhas };
  }
}
