import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Drone, PipelineRun, Voo, YoloFeedback } from '../entities/drone';

export class DroneViewModel {
  static toHttp(d: Drone) {
    return {
      id: d.id,
      clienteId: d.clienteId,
      nome: d.nome,
      modelo: d.modelo,
      serial: d.serial,
      ativo: d.ativo,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      ...baseAuditToHttp(d),
    };
  }
  static vooToHttp(v: Voo) {
    return {
      id: v.id,
      planejamentoId: v.planejamentoId,
      vooNumero: v.vooNumero,
      inicio: v.inicio,
      fim: v.fim,
      duracaoMin: v.duracaoMin,
      km: v.km,
      ha: v.ha,
      baterias: v.baterias,
      fotos: v.fotos,
      amostraLat: v.amostraLat,
      amostraLon: v.amostraLon,
      amostraDataHora: v.amostraDataHora,
      amostraArquivo: v.amostraArquivo,
      wxError: v.wxError,
      wxDetail: v.wxDetail,
      pilotoId: v.pilotoId,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      ...baseAuditToHttp(v),
    };
  }
  static pipelineToHttp(p: PipelineRun) {
    return {
      id: p.id,
      clienteId: p.clienteId,
      vooId: p.vooId,
      levantamentoId: p.levantamentoId,
      status: p.status,
      totalImagens: p.totalImagens,
      imagensProcessadas: p.imagensProcessadas,
      itensGerados: p.itensGerados,
      focosCriados: p.focosCriados,
      erroMensagem: p.erroMensagem,
      versaoPipeline: p.versaoPipeline,
      iniciadoEm: p.iniciadoEm,
      concluidoEm: p.concluidoEm,
      createdAt: p.createdAt,
      ...baseAuditToHttp(p),
    };
  }
  static feedbackToHttp(f: YoloFeedback) {
    return {
      id: f.id,
      levantamentoItemId: f.levantamentoItemId,
      clienteId: f.clienteId,
      confirmado: f.confirmado,
      observacao: f.observacao,
      registradoPor: f.registradoPor,
      createdAt: f.createdAt,
      ...baseAuditToHttp(f),
    };
  }
}
