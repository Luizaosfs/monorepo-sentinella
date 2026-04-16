import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { SlaOperacional } from '../entities/sla-operacional';

export class SlaOperacionalViewModel {
  static toHttp(sla: SlaOperacional) {
    return {
      id: sla.id,
      clienteId: sla.clienteId,
      operadorId: sla.operadorId,
      prioridade: sla.prioridade,
      slaHoras: sla.slaHoras,
      inicio: sla.inicio,
      prazoFinal: sla.prazoFinal,
      concluidoEm: sla.concluidoEm,
      status: sla.status,
      violado: sla.violado,
      escalonado: sla.escalonado,
      escalonadoEm: sla.escalonadoEm,
      prioridadeOriginal: sla.prioridadeOriginal,
      levantamentoItemId: sla.levantamentoItemId,
      focoRiscoId: sla.focoRiscoId,
      escalonadoAutomatico: sla.escalonadoAutomatico,
      escaladoPor: sla.escaladoPor,
      createdAt: sla.createdAt,
      updatedAt: sla.updatedAt,
      ...baseAuditToHttp(sla),
    };
  }
}
