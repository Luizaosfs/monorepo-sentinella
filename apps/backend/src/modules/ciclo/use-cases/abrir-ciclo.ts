import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { Ciclo } from '../entities/ciclo';
import { AbrirCicloInput } from '../dtos/abrir-ciclo.body';
import { CicloException } from '../errors/ciclo.exception';
import { CicloReadRepository } from '../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../repositories/ciclo-write.repository';

@Injectable()
export class AbrirCiclo {
  constructor(
    private readRepository: CicloReadRepository,
    private writeRepository: CicloWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: AbrirCicloInput) {
    const clienteId = this.req['tenantId'] as string;
    const userId = (this.req['user'] as { id: string }).id;
    const ano = input.ano ?? new Date().getFullYear();

    const ativo = await this.readRepository.findAtivo(clienteId);
    if (ativo) throw CicloException.jaExisteAtivo();

    // Datas do bimestre: numero 1 → Jan-Fev, 2 → Mar-Abr, ..., 6 → Nov-Dez
    const mesInicio = (input.numero - 1) * 2; // 0-indexed para Date
    const dataInicio = new Date(ano, mesInicio, 1);
    const dataFimPrevista = new Date(ano, mesInicio + 2, 0); // último dia do 2º mês

    const entity = new Ciclo(
      {
        clienteId,
        numero: input.numero,
        ano,
        status: 'ativo',
        dataInicio,
        dataFimPrevista,
        metaCoberturaPct: input.metaCoberturaPct ?? 100,
        observacaoAbertura: input.observacao,
        abertoPor: userId,
      },
      { id: undefined, createdAt: new Date(), updatedAt: new Date() },
    );

    const ciclo = await this.writeRepository.abrirCiclo(entity);

    return {
      ok: true,
      cicloId: ciclo.id,
      numero: ciclo.numero,
      ano: ciclo.ano,
      dataInicio: ciclo.dataInicio,
      dataFim: ciclo.dataFimPrevista,
    };
  }
}
