import { Injectable } from '@nestjs/common';

import { AddEvidenciaBody } from '../dtos/add-evidencia.body';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class AddEvidencia {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
  ) {}

  async execute(operacaoId: string, data: AddEvidenciaBody) {
    const operacao = await this.readRepository.findById(operacaoId);
    if (!operacao) throw OperacaoException.notFound();

    const evidencia = await this.writeRepository.addEvidencia({
      operacaoId,
      imageUrl: data.imageUrl,
      legenda: data.legenda,
      publicId: data.publicId,
    });
    return { evidencia };
  }
}
