import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { DistribuicaoQuarteirao, Quarteirao } from '../entities/quarteirao';

export class QuarteiraoViewModel {
  static toHttp(q: Quarteirao) {
    return {
      id: q.id,
      clienteId: q.clienteId,
      regiaoId: q.regiaoId,
      codigo: q.codigo,
      bairro: q.bairro,
      ativo: q.ativo,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      ...baseAuditToHttp(q),
    };
  }
}

export class DistribuicaoQuarteiraoViewModel {
  static toHttp(d: DistribuicaoQuarteirao) {
    return {
      id: d.id,
      clienteId: d.clienteId,
      ciclo: d.ciclo,
      quarteirao: d.quarteirao,
      agenteId: d.agenteId,
      regiaoId: d.regiaoId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      ...baseAuditToHttp(d),
    };
  }
}
