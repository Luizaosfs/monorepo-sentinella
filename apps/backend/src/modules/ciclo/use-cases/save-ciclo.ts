import { Injectable } from '@nestjs/common';

import { SaveCicloBody } from '../dtos/save-ciclo.body';
import { CicloException } from '../errors/ciclo.exception';
import { CicloReadRepository } from '../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../repositories/ciclo-write.repository';

@Injectable()
export class SaveCiclo {
  constructor(
    private readRepository: CicloReadRepository,
    private writeRepository: CicloWriteRepository,
  ) {}

  async execute(id: string, input: SaveCicloBody) {
    const ciclo = await this.readRepository.findById(id);
    if (!ciclo) throw CicloException.notFound();

    if (input.numero !== undefined) ciclo.numero = input.numero;
    if (input.ano !== undefined) ciclo.ano = input.ano;
    if (input.status !== undefined) ciclo.status = input.status;
    if (input.dataInicio !== undefined)
      ciclo.dataInicio = input.dataInicio as Date;
    if (input.dataFimPrevista !== undefined)
      ciclo.dataFimPrevista = input.dataFimPrevista as Date;
    if (input.observacaoAbertura !== undefined)
      ciclo.observacaoAbertura = input.observacaoAbertura;
    if (input.observacaoFechamento !== undefined)
      ciclo.observacaoFechamento = input.observacaoFechamento;

    await this.writeRepository.save(ciclo);
    return { ciclo };
  }
}
