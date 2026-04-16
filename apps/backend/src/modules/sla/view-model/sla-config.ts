import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { SlaConfig, SlaFeriado, SlaFocoConfig } from '../entities/sla-config';

export class SlaConfigViewModel {
  static toHttp(config: SlaConfig) {
    return {
      id: config.id,
      clienteId: config.clienteId,
      config: config.config,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      ...baseAuditToHttp(config),
    };
  }
}

export class SlaFeriadoViewModel {
  static toHttp(feriado: SlaFeriado) {
    return {
      id: feriado.id,
      clienteId: feriado.clienteId,
      data: feriado.data,
      descricao: feriado.descricao,
      nacional: feriado.nacional,
      createdAt: feriado.createdAt,
      ...baseAuditToHttp(feriado),
    };
  }
}

export class SlaFocoConfigViewModel {
  static toHttp(config: SlaFocoConfig) {
    return {
      id: config.id,
      clienteId: config.clienteId,
      fase: config.fase,
      prazoMinutos: config.prazoMinutos,
      ativo: config.ativo,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      ...baseAuditToHttp(config),
    };
  }
}
