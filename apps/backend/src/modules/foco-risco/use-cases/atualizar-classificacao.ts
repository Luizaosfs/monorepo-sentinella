import { Injectable } from '@nestjs/common';

import { ClassificacaoInicialInput } from '../dtos/classificacao-inicial.body';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class AtualizarClassificacao {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
  ) {}

  async execute(id: string, input: ClassificacaoInicialInput, clienteId: string | null) {
    const foco = await this.readRepository.findById(id, clienteId);
    if (!foco) throw FocoRiscoException.notFound();

    foco.classificacaoInicial = input.classificacao;

    await this.writeRepository.save(foco);

    return { foco };
  }
}
