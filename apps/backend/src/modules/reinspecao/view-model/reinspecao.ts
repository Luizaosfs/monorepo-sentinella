import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Reinspecao } from '../entities/reinspecao';

export class ReinspecaoViewModel {
  static toHttp(r: Reinspecao) {
    return {
      id: r.id,
      clienteId: r.clienteId,
      focoRiscoId: r.focoRiscoId,
      status: r.status,
      tipo: r.tipo,
      origem: r.origem,
      dataPrevista: r.dataPrevista,
      dataRealizada: r.dataRealizada,
      responsavelId: r.responsavelId,
      observacao: r.observacao,
      resultado: r.resultado,
      criadoPor: r.criadoPor,
      canceladoPor: r.canceladoPor,
      motivoCancelamento: r.motivoCancelamento,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ...baseAuditToHttp(r),
    };
  }
}
