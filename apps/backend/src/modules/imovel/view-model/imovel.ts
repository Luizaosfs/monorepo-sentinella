import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { Imovel } from '../entities/imovel';

export class ImovelViewModel {
  static toHttp(imovel: Imovel) {
    return {
      id: imovel.id,
      clienteId: imovel.clienteId,
      regiaoId: imovel.regiaoId,
      tipoImovel: imovel.tipoImovel,
      logradouro: imovel.logradouro,
      numero: imovel.numero,
      complemento: imovel.complemento,
      bairro: imovel.bairro,
      quarteirao: imovel.quarteirao,
      latitude: imovel.latitude,
      longitude: imovel.longitude,
      ativo: imovel.ativo,
      proprietarioAusente: imovel.proprietarioAusente,
      tipoAusencia: imovel.tipoAusencia,
      contatoProprietario: imovel.contatoProprietario,
      temAnimalAgressivo: imovel.temAnimalAgressivo,
      historicoRecusa: imovel.historicoRecusa,
      temCalha: imovel.temCalha,
      calhaAcessivel: imovel.calhaAcessivel,
      prioridadeDrone: imovel.prioridadeDrone,
      notificacaoFormalEm: imovel.notificacaoFormalEm,
      createdAt: imovel.createdAt,
      updatedAt: imovel.updatedAt,
      ...baseAuditToHttp(imovel),
    };
  }
}
