import { Injectable } from '@nestjs/common';

import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class GetOperacao {
  constructor(private repository: OperacaoReadRepository) {}

  async execute(id: string) {
    const operacao = await this.repository.findByIdComEvidencias(id);
    if (!operacao) throw OperacaoException.notFound();
    return { operacao };
  }
}
