import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { PluvioItem, PluvioRisco, PluvioRun } from '../entities/pluvio';

export class PluvioRunViewModel {
  static toHttp(run: PluvioRun) {
    return {
      id: run.id,
      clienteId: run.clienteId,
      dataReferencia: run.dataReferencia,
      total: run.total,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      ...baseAuditToHttp(run),
    };
  }
}

export class PluvioItemViewModel {
  static toHttp(item: PluvioItem) {
    return {
      id: item.id,
      runId: item.runId,
      regiaoId: item.regiaoId,
      imovelId: item.imovelId,
      precipitacao: item.precipitacao,
      nivelRisco: item.nivelRisco,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ...baseAuditToHttp(item),
    };
  }
}

export class PluvioRiscoViewModel {
  static toHttp(risco: PluvioRisco) {
    return {
      id: risco.id,
      regiaoId: risco.regiaoId,
      nivel: risco.nivel,
      precipitacaoAcumulada: risco.precipitacaoAcumulada,
      dataReferencia: risco.dataReferencia,
      observacoes: risco.observacoes,
      createdAt: risco.createdAt,
      updatedAt: risco.updatedAt,
      ...baseAuditToHttp(risco),
    };
  }
}
