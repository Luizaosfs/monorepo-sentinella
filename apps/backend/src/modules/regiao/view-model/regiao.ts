import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Regiao } from '../entities/regiao';

export class RegiaoViewModel {
  static toHttp(regiao: Regiao) {
    return {
      id: regiao.id,
      clienteId: regiao.clienteId,
      nome: regiao.nome,
      regiao: regiao.nome, // alias — frontend type uses `regiao` as primary field
      tipo: regiao.tipo,
      cor: regiao.cor,
      geojson: regiao.geojson,
      ativo: regiao.ativo,
      latitude: regiao.latitude ?? null,
      longitude: regiao.longitude ?? null,
      createdAt: regiao.createdAt,
      updatedAt: regiao.updatedAt,
      ...baseAuditToHttp(regiao),
    };
  }
}
