import { Injectable } from '@nestjs/common';

import { CreatePlanoBody } from '../dtos/create-billing.body';
import { Plano } from '../entities/billing';
import { BillingWriteRepository } from '../repositories/billing-write.repository';

@Injectable()
export class CreatePlano {
  constructor(private repository: BillingWriteRepository) {}

  async execute(input: CreatePlanoBody): Promise<{ plano: Plano }> {
    const entity = new Plano(
      {
        nome: input.nome,
        descricao: input.descricao,
        precoMensal: input.precoMensal,
        limiteUsuarios: input.limiteUsuarios,
        limiteImoveis: input.limiteImoveis,
        limiteVistoriasMes: input.limiteVistoriasMes,
        limiteLevantamentosMes: input.limiteLevantamentosMes,
        limiteVoosMes: input.limiteVoosMes,
        limiteStorageGb: input.limiteStorageGb,
        limiteIaCallsMes: input.limiteIaCallsMes,
        limiteDenunciasMes: input.limiteDenunciasMes,
        droneHabilitado: input.droneHabilitado ?? false,
        slaAvancado: input.slaAvancado ?? false,
        integracoesHabilitadas: input.integracoesHabilitadas ?? [],
        ativo: input.ativo ?? true,
        ordem: input.ordem ?? 0,
      },
      {},
    );
    const created = await this.repository.createPlano(entity);
    return { plano: created };
  }
}
