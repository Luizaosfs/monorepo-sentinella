import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { FecharCicloInput } from '../dtos/fechar-ciclo.body';
import { CicloException } from '../errors/ciclo.exception';
import { CicloReadRepository } from '../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../repositories/ciclo-write.repository';

@Injectable()
export class FecharCiclo {
  constructor(
    private readRepository: CicloReadRepository,
    private writeRepository: CicloWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: FecharCicloInput) {
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as { id: string }).id;
    const ano = input.ano ?? new Date().getFullYear();

    const ciclo = await this.readRepository.findByNumeroAno(
      clienteId,
      input.numero,
      ano,
    );
    if (!ciclo) throw CicloException.notFound();
    if (ciclo.status === 'fechado') throw CicloException.jaFechado();

    const { snapshot } = await this.writeRepository.fecharCiclo(ciclo.id!, clienteId, {
      dataFechamento: new Date(),
      fechadoPor: userId,
      observacaoFechamento: input.observacao,
    });

    return { ok: true, numero: ciclo.numero, ano: ciclo.ano, snapshot };
  }
}
