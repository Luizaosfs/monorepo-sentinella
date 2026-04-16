import {
  BillingCiclo,
  ClientePlano,
  ClienteQuotas,
  Plano,
} from 'src/modules/billing/entities/billing';

export class PrismaBillingMapper {
  static planoToDomain(raw: any): Plano {
    return new Plano(
      {
        nome: raw.nome,
        descricao: raw.descricao ?? undefined,
        precoMensal: raw.preco_mensal ? Number(raw.preco_mensal) : undefined,
        limiteUsuarios: raw.limite_usuarios ?? undefined,
        limiteImoveis: raw.limite_imoveis ?? undefined,
        limiteVistoriasMes: raw.limite_vistorias_mes ?? undefined,
        limiteLevantamentosMes: raw.limite_levantamentos_mes ?? undefined,
        limiteVoosMes: raw.limite_voos_mes ?? undefined,
        limiteStorageGb: raw.limite_storage_gb
          ? Number(raw.limite_storage_gb)
          : undefined,
        limiteIaCallsMes: raw.limite_ia_calls_mes ?? undefined,
        limiteDenunciasMes: raw.limite_denuncias_mes ?? undefined,
        droneHabilitado: raw.drone_habilitado,
        slaAvancado: raw.sla_avancado,
        integracoesHabilitadas: raw.integracoes_habilitadas ?? [],
        ativo: raw.ativo,
        ordem: raw.ordem,
      },
      { id: raw.id, createdAt: raw.created_at },
    );
  }

  static planoToPrisma(entity: Plano) {
    return {
      nome: entity.nome,
      descricao: entity.descricao ?? null,
      preco_mensal: entity.precoMensal ?? null,
      limite_usuarios: entity.limiteUsuarios ?? null,
      limite_imoveis: entity.limiteImoveis ?? null,
      limite_vistorias_mes: entity.limiteVistoriasMes ?? null,
      limite_levantamentos_mes: entity.limiteLevantamentosMes ?? null,
      limite_voos_mes: entity.limiteVoosMes ?? null,
      limite_storage_gb: entity.limiteStorageGb ?? null,
      limite_ia_calls_mes: entity.limiteIaCallsMes ?? null,
      limite_denuncias_mes: entity.limiteDenunciasMes ?? null,
      drone_habilitado: entity.droneHabilitado,
      sla_avancado: entity.slaAvancado,
      integracoes_habilitadas: entity.integracoesHabilitadas,
      ativo: entity.ativo,
      ordem: entity.ordem,
    };
  }

  static clientePlanToDomain(raw: any): ClientePlano {
    return new ClientePlano(
      {
        clienteId: raw.cliente_id,
        planoId: raw.plano_id,
        dataInicio: raw.data_inicio,
        dataFim: raw.data_fim ?? undefined,
        status: raw.status,
        limitesPersonalizados: raw.limites_personalizados ?? undefined,
        contratoRef: raw.contrato_ref ?? undefined,
        observacao: raw.observacao ?? undefined,
        dataTrialFim: raw.data_trial_fim ?? undefined,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static clientePlanToPrisma(entity: ClientePlano) {
    return {
      cliente_id: entity.clienteId,
      plano_id: entity.planoId,
      data_inicio: entity.dataInicio,
      data_fim: entity.dataFim ?? null,
      status: entity.status,
      limites_personalizados: entity.limitesPersonalizados ?? null,
      contrato_ref: entity.contratoRef ?? null,
      observacao: entity.observacao ?? null,
      data_trial_fim: entity.dataTrialFim ?? null,
    };
  }

  static cicleToDomain(raw: any): BillingCiclo {
    return new BillingCiclo(
      {
        clienteId: raw.cliente_id,
        clientePlanoId: raw.cliente_plano_id ?? undefined,
        periodoInicio: raw.periodo_inicio,
        periodoFim: raw.periodo_fim,
        status: raw.status,
        valorBase: raw.valor_base ? Number(raw.valor_base) : undefined,
        valorExcedente: Number(raw.valor_excedente),
        valorTotal: raw.valor_total ? Number(raw.valor_total) : undefined,
        notaFiscalRef: raw.nota_fiscal_ref ?? undefined,
        pagoEm: raw.pago_em ?? undefined,
        observacao: raw.observacao ?? undefined,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static cicleToPrisma(entity: BillingCiclo) {
    return {
      cliente_id: entity.clienteId,
      cliente_plano_id: entity.clientePlanoId ?? null,
      periodo_inicio: entity.periodoInicio,
      periodo_fim: entity.periodoFim,
      status: entity.status,
      valor_base: entity.valorBase ?? null,
      valor_excedente: entity.valorExcedente,
      observacao: entity.observacao ?? null,
    };
  }

  static quotasToDomain(raw: any): ClienteQuotas {
    return new ClienteQuotas(
      {
        clienteId: raw.cliente_id,
        voosMes: raw.voos_mes ?? undefined,
        levantamentosMes: raw.levantamentos_mes ?? undefined,
        itensMes: raw.itens_mes ?? undefined,
        usuariosAtivos: raw.usuarios_ativos ?? undefined,
        vistoriasMes: raw.vistorias_mes ?? undefined,
        iaCallsMes: raw.ia_calls_mes ?? undefined,
        storageGb: raw.storage_gb ? Number(raw.storage_gb) : undefined,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static quotasToPrisma(entity: ClienteQuotas) {
    return {
      cliente_id: entity.clienteId,
      voos_mes: entity.voosMes ?? null,
      levantamentos_mes: entity.levantamentosMes ?? null,
      itens_mes: entity.itensMes ?? null,
      usuarios_ativos: entity.usuariosAtivos ?? null,
      vistorias_mes: entity.vistoriasMes ?? null,
      ia_calls_mes: entity.iaCallsMes ?? null,
      storage_gb: entity.storageGb ?? null,
    };
  }
}
