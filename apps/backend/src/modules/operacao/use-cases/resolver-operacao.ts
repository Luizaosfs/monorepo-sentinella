import { Injectable } from '@nestjs/common';

import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class ResolverOperacao {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
  ) {}

  async execute(id: string) {
    const operacao = await this.readRepository.findById(id);
    if (!operacao) throw OperacaoException.notFound();

    operacao.status = 'concluido';
    operacao.concluidoEm = new Date();

    await this.writeRepository.save(operacao);
    return { operacao };
  }
}
