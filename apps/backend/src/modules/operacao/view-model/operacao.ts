import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Operacao, OperacaoEvidencia } from '../entities/operacao';

export class OperacaoViewModel {
  static evidenciaToHttp(ev: OperacaoEvidencia) {
    return {
      id: ev.id,
      imageUrl: ev.imageUrl,
      legenda: ev.legenda,
      publicId: ev.publicId,
      createdAt: ev.createdAt,
    };
  }

  static toHttp(operacao: Operacao) {
    return {
      id: operacao.id,
      clienteId: operacao.clienteId,
      status: operacao.status,
      prioridade: operacao.prioridade,
      responsavelId: operacao.responsavelId,
      observacao: operacao.observacao,
      tipoVinculo: operacao.tipoVinculo,
      itemOperacionalId: operacao.itemOperacionalId,
      itemLevantamentoId: operacao.itemLevantamentoId,
      regiaoId: operacao.regiaoId,
      focoRiscoId: operacao.focoRiscoId,
      iniciadoEm: operacao.iniciadoEm,
      concluidoEm: operacao.concluidoEm,
      evidencias: operacao.evidencias?.map(OperacaoViewModel.evidenciaToHttp),
      createdAt: operacao.createdAt,
      updatedAt: operacao.updatedAt,
      ...baseAuditToHttp(operacao),
    };
  }
}
