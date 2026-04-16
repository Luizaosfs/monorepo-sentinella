import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Planejamento } from '../entities/planejamento';

export class PlanejamentoViewModel {
  static toHttp(planejamento: Planejamento) {
    return {
      id: planejamento.id,
      clienteId: planejamento.clienteId,
      descricao: planejamento.descricao,
      dataPlanejamento: planejamento.dataPlanejamento,
      areaTotal: planejamento.areaTotal,
      alturaVoo: planejamento.alturaVoo,
      tipo: planejamento.tipo,
      ativo: planejamento.ativo,
      tipoEntrada: planejamento.tipoEntrada,
      tipoLevantamento: planejamento.tipoLevantamento,
      regiaoId: planejamento.regiaoId,
      createdAt: planejamento.createdAt,
      updatedAt: planejamento.updatedAt,
      ...baseAuditToHttp(planejamento),
    };
  }
}
