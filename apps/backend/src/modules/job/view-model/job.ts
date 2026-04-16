import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Job } from '../entities/job';

export class JobViewModel {
  static toHttp(j: Job) {
    return {
      id: j.id,
      tipo: j.tipo,
      payload: j.payload,
      status: j.status,
      tentativas: j.tentativas,
      erro: j.erro,
      agendadoEm: j.agendadoEm,
      iniciadoEm: j.iniciadoEm,
      concluidoEm: j.concluidoEm,
      createdAt: j.createdAt,
      ...baseAuditToHttp(j),
    };
  }
}
