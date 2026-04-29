import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { AddEvidenciaBody } from '../dtos/add-evidencia.body';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class AddEvidencia {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(operacaoId: string, data: AddEvidenciaBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const operacao = await this.readRepository.findById(operacaoId, clienteId);
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
