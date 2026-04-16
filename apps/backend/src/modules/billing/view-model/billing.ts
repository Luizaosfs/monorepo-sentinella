import { baseAuditToHttp } from '@shared/view-model/base-audit';

import {
  BillingCiclo,
  ClientePlano,
  ClienteQuotas,
  Plano,
} from '../entities/billing';

export class BillingViewModel {
  static toHttp(p: Plano) {
    return {
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      precoMensal: p.precoMensal,
      limiteUsuarios: p.limiteUsuarios,
      limiteImoveis: p.limiteImoveis,
      limiteVistoriasMes: p.limiteVistoriasMes,
      limiteLevantamentosMes: p.limiteLevantamentosMes,
      limiteVoosMes: p.limiteVoosMes,
      limiteStorageGb: p.limiteStorageGb,
      limiteIaCallsMes: p.limiteIaCallsMes,
      limiteDenunciasMes: p.limiteDenunciasMes,
      droneHabilitado: p.droneHabilitado,
      slaAvancado: p.slaAvancado,
      integracoesHabilitadas: p.integracoesHabilitadas,
      ativo: p.ativo,
      ordem: p.ordem,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      ...baseAuditToHttp(p),
    };
  }

  static clientePlanoToHttp(cp: ClientePlano) {
    return {
      id: cp.id,
      clienteId: cp.clienteId,
      planoId: cp.planoId,
      dataInicio: cp.dataInicio,
      dataFim: cp.dataFim,
      status: cp.status,
      limitesPersonalizados: cp.limitesPersonalizados,
      contratoRef: cp.contratoRef,
      dataTrialFim: cp.dataTrialFim,
      createdAt: cp.createdAt,
      updatedAt: cp.updatedAt,
      ...baseAuditToHttp(cp),
    };
  }

  static cicloToHttp(c: BillingCiclo) {
    return {
      id: c.id,
      clienteId: c.clienteId,
      clientePlanoId: c.clientePlanoId,
      periodoInicio: c.periodoInicio,
      periodoFim: c.periodoFim,
      status: c.status,
      valorBase: c.valorBase,
      valorExcedente: c.valorExcedente,
      valorTotal: c.valorTotal,
      notaFiscalRef: c.notaFiscalRef,
      pagoEm: c.pagoEm,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ...baseAuditToHttp(c),
    };
  }

  static quotasToHttp(q: ClienteQuotas) {
    return {
      id: q.id,
      clienteId: q.clienteId,
      voosMes: q.voosMes,
      levantamentosMes: q.levantamentosMes,
      itensMes: q.itensMes,
      usuariosAtivos: q.usuariosAtivos,
      vistoriasMes: q.vistoriasMes,
      iaCallsMes: q.iaCallsMes,
      storageGb: q.storageGb,
      updatedAt: q.updatedAt,
      ...baseAuditToHttp(q),
    };
  }
}
