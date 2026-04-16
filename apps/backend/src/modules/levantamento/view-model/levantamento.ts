import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Levantamento, LevantamentoItem } from '../entities/levantamento';

export class LevantamentoViewModel {
  static itemToHttp(item: LevantamentoItem) {
    return {
      id: item.id,
      levantamentoId: item.levantamentoId,
      clienteId: item.clienteId,
      arquivo: item.arquivo,
      latitude: item.latitude,
      longitude: item.longitude,
      item: item.item,
      risco: item.risco,
      peso: item.peso,
      acao: item.acao,
      scoreFinal: item.scoreFinal,
      prioridade: item.prioridade,
      slaHoras: item.slaHoras,
      enderecoCurto: item.enderecoCurto,
      enderecoCompleto: item.enderecoCompleto,
      maps: item.maps,
      waze: item.waze,
      dataHora: item.dataHora,
      imageUrl: item.imageUrl,
      idDrone: item.idDrone,
      altitudeM: item.altitudeM,
      alturaRelativaM: item.alturaRelativaM,
      focalMm: item.focalMm,
      iso: item.iso,
      exposureS: item.exposureS,
      megapixels: item.megapixels,
      inclinacaoCameraGraus: item.inclinacaoCameraGraus,
      direcaoYawGraus: item.direcaoYawGraus,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      detecoes: item.detecoes,
      evidencias: item.evidencias,
    };
  }

  static toHttp(levantamento: Levantamento) {
    return {
      id: levantamento.id,
      clienteId: levantamento.clienteId,
      planejamentoId: levantamento.planejamentoId,
      cicloId: levantamento.cicloId,
      idDrone: levantamento.idDrone,
      usuarioId: levantamento.usuarioId,
      titulo: levantamento.titulo,
      tipoEntrada: levantamento.tipoEntrada,
      dataVoo: levantamento.dataVoo,
      statusProcessamento: levantamento.statusProcessamento,
      totalItens: levantamento.totalItens,
      observacao: levantamento.observacao,
      concluidoEm: levantamento.concluidoEm,
      ...baseAuditToHttp(levantamento),
      itens: levantamento.itens?.map(LevantamentoViewModel.itemToHttp),
    };
  }
}
