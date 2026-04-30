import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { SavePlanoAcaoBody } from '../dtos/save-plano-acao.body';
import { PlanoAcaoException } from '../errors/plano-acao.exception';
import { PlanoAcaoReadRepository } from '../repositories/plano-acao-read.repository';
import { PlanoAcaoWriteRepository } from '../repositories/plano-acao-write.repository';

@Injectable()
export class SavePlanoAcao {
  constructor(
    private readRepository: PlanoAcaoReadRepository,
    private writeRepository: PlanoAcaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, data: SavePlanoAcaoBody) {
    const tenantId = getAccessScope(this.req).tenantId;
    if (!tenantId) {
      throw PlanoAcaoException.tenantRequired();
    }

    const planoAcao = await this.readRepository.findById(id, tenantId);
    if (!planoAcao) throw PlanoAcaoException.notFound();

    if (data.label !== undefined) planoAcao.label = data.label;
    if (data.descricao !== undefined)
      planoAcao.descricao = data.descricao ?? undefined;
    if (data.tipoItem !== undefined)
      planoAcao.tipoItem = data.tipoItem ?? undefined;
    if (data.ativo !== undefined) planoAcao.ativo = data.ativo;
    if (data.ordem !== undefined) planoAcao.ordem = data.ordem;

    await this.writeRepository.save(planoAcao);
    return { planoAcao };
  }
}
