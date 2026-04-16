import { Injectable } from '@nestjs/common';

import { SavePlanoBody } from '../dtos/create-billing.body';
import { Plano } from '../entities/billing';
import { BillingException } from '../errors/billing.exception';
import { BillingReadRepository } from '../repositories/billing-read.repository';
import { BillingWriteRepository } from '../repositories/billing-write.repository';

@Injectable()
export class SavePlano {
  constructor(
    private readRepository: BillingReadRepository,
    private writeRepository: BillingWriteRepository,
  ) {}

  async execute(id: string, input: SavePlanoBody): Promise<{ plano: Plano }> {
    const plano = await this.readRepository.findPlanoById(id);
    if (!plano) throw BillingException.planoNotFound();

    if (input.nome !== undefined) plano.nome = input.nome;
    if (input.descricao !== undefined) plano.descricao = input.descricao;
    if (input.precoMensal !== undefined) plano.precoMensal = input.precoMensal;
    if (input.ativo !== undefined) plano.ativo = input.ativo;

    await this.writeRepository.savePlano(plano);
    return { plano };
  }
}
