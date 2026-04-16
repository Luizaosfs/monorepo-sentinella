import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { PlanoAcao } from '../entities/plano-acao';

export class PlanoAcaoViewModel {
  static toHttp(planoAcao: PlanoAcao) {
    return {
      id: planoAcao.id,
      clienteId: planoAcao.clienteId,
      label: planoAcao.label,
      descricao: planoAcao.descricao ?? null,
      tipoItem: planoAcao.tipoItem ?? null,
      ativo: planoAcao.ativo,
      ordem: planoAcao.ordem,
      createdAt: planoAcao.createdAt,
      updatedAt: planoAcao.updatedAt,
      ...baseAuditToHttp(planoAcao),
    };
  }
}
