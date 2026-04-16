import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Ciclo } from '../entities/ciclo';

export class CicloViewModel {
  static toHttp(ciclo: Ciclo) {
    return {
      id: ciclo.id,
      clienteId: ciclo.clienteId,
      numero: ciclo.numero,
      ano: ciclo.ano,
      status: ciclo.status,
      dataInicio: ciclo.dataInicio,
      dataFimPrevista: ciclo.dataFimPrevista,
      dataFechamento: ciclo.dataFechamento ?? null,
      metaCoberturaPct: ciclo.metaCoberturaPct ?? null,
      snapshotFechamento: ciclo.snapshotFechamento ?? null,
      observacaoAbertura: ciclo.observacaoAbertura ?? null,
      observacaoFechamento: ciclo.observacaoFechamento ?? null,
      abertoPor: ciclo.abertoPor ?? null,
      fechadoPor: ciclo.fechadoPor ?? null,
      createdAt: ciclo.createdAt,
      updatedAt: ciclo.updatedAt,
      ...baseAuditToHttp(ciclo),
    };
  }
}
