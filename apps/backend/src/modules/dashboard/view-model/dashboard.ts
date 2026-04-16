import { baseAuditToHttp } from '@shared/view-model/base-audit';

import {
  RelatorioGerado,
  ResumoDiario,
  SystemAlert,
  SystemHealthLog,
} from '../entities/dashboard';

export class DashboardViewModel {
  static toHttp(r: ResumoDiario) {
    return {
      id: r.id,
      clienteId: r.clienteId,
      dataRef: r.dataRef,
      sumario: r.sumario,
      metricas: r.metricas,
      createdAt: r.createdAt,
      ...baseAuditToHttp(r),
    };
  }

  static relatorioToHttp(r: RelatorioGerado) {
    return {
      id: r.id,
      clienteId: r.clienteId,
      geradoPor: r.geradoPor,
      periodoInicio: r.periodoInicio,
      periodoFim: r.periodoFim,
      payload: r.payload,
      createdAt: r.createdAt,
      ...baseAuditToHttp(r),
    };
  }

  static healthToHttp(h: SystemHealthLog) {
    return {
      id: h.id,
      servico: h.servico,
      status: h.status,
      detalhes: h.detalhes,
      criadoEm: h.criadoEm,
      ...baseAuditToHttp(h),
    };
  }

  static alertToHttp(a: SystemAlert) {
    return {
      id: a.id,
      servico: a.servico,
      nivel: a.nivel,
      mensagem: a.mensagem,
      resolvido: a.resolvido,
      resolvidoEm: a.resolvidoEm,
      criadoEm: a.criadoEm,
      ...baseAuditToHttp(a),
    };
  }
}
