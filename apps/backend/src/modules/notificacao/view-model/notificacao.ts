import { baseAuditToHttp } from '@shared/view-model/base-audit';

import {
  CasoNotificado,
  ItemNotificacaoEsus,
  PushSubscription,
  UnidadeSaude,
} from '../entities/notificacao';

export class NotificacaoViewModel {
  static unidadeToHttp(u: UnidadeSaude) {
    return {
      id: u.id,
      clienteId: u.clienteId,
      nome: u.nome,
      tipo: u.tipo,
      endereco: u.endereco,
      latitude: u.latitude,
      longitude: u.longitude,
      ativo: u.ativo,
      cnes: u.cnes,
      tipoSentinela: u.tipoSentinela,
      telefone: u.telefone,
      bairro: u.bairro,
      municipio: u.municipio,
      uf: u.uf,
      origem: u.origem,
      ultimaSyncEm: u.ultimaSyncEm,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      ...baseAuditToHttp(u),
    };
  }

  static toHttp(c: CasoNotificado) {
    return {
      id: c.id,
      clienteId: c.clienteId,
      unidadeSaudeId: c.unidadeSaudeId,
      notificadorId: c.notificadorId,
      doenca: c.doenca,
      status: c.status,
      dataInicioSintomas: c.dataInicioSintomas,
      dataNotificacao: c.dataNotificacao,
      logradouroBairro: c.logradouroBairro,
      bairro: c.bairro,
      latitude: c.latitude,
      longitude: c.longitude,
      regiaoId: c.regiaoId,
      observacao: c.observacao,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ...baseAuditToHttp(c),
    };
  }

  static pushToHttp(p: PushSubscription) {
    return {
      id: p.id,
      usuarioId: p.usuarioId,
      clienteId: p.clienteId,
      endpoint: p.endpoint,
      createdAt: p.createdAt,
      ...baseAuditToHttp(p),
    };
  }

  static esusToHttp(e: ItemNotificacaoEsus) {
    return {
      id: e.id,
      clienteId: e.clienteId,
      levantamentoItemId: e.levantamentoItemId,
      tipoAgravo: e.tipoAgravo,
      numeroNotificacao: e.numeroNotificacao,
      status: e.status,
      erroMensagem: e.erroMensagem,
      enviadoPor: e.enviadoPor,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      ...baseAuditToHttp(e),
    };
  }
}
