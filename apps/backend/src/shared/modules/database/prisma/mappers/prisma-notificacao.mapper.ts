import {
  CasoNotificado,
  ItemNotificacaoEsus,
  PushSubscription,
  UnidadeSaude,
} from 'src/modules/notificacao/entities/notificacao';

export class PrismaNotificacaoMapper {
  static unidadeToDomain(raw: any): UnidadeSaude {
    return new UnidadeSaude(
      {
        clienteId: raw.cliente_id,
        nome: raw.nome,
        tipo: raw.tipo,
        endereco: raw.endereco ?? undefined,
        latitude: raw.latitude ?? undefined,
        longitude: raw.longitude ?? undefined,
        ativo: raw.ativo,
        cnes: raw.cnes ?? undefined,
        tipoSentinela: raw.tipo_sentinela,
        telefone: raw.telefone ?? undefined,
        bairro: raw.bairro ?? undefined,
        municipio: raw.municipio ?? undefined,
        uf: raw.uf ?? undefined,
        origem: raw.origem,
        ultimaSyncEm: raw.ultima_sync_em ?? undefined,
        deletedAt: raw.deleted_at ?? undefined,
        deletedBy: raw.deleted_by ?? undefined,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static unidadeToPrisma(entity: UnidadeSaude) {
    return {
      cliente_id: entity.clienteId,
      nome: entity.nome,
      tipo: entity.tipo,
      endereco: entity.endereco ?? null,
      latitude: entity.latitude ?? null,
      longitude: entity.longitude ?? null,
      ativo: entity.ativo,
      cnes: entity.cnes ?? null,
      tipo_sentinela: entity.tipoSentinela,
      telefone: entity.telefone ?? null,
      bairro: entity.bairro ?? null,
      municipio: entity.municipio ?? null,
      uf: entity.uf ?? null,
      origem: entity.origem,
    };
  }

  static casoToDomain(raw: any): CasoNotificado {
    return new CasoNotificado(
      {
        clienteId: raw.cliente_id,
        unidadeSaudeId: raw.unidade_saude_id,
        notificadorId: raw.notificador_id ?? undefined,
        doenca: raw.doenca,
        status: raw.status,
        dataInicioSintomas: raw.data_inicio_sintomas ?? undefined,
        dataNotificacao: raw.data_notificacao,
        logradouroBairro: raw.logradouro_bairro ?? undefined,
        bairro: raw.bairro ?? undefined,
        latitude: raw.latitude ?? undefined,
        longitude: raw.longitude ?? undefined,
        regiaoId: raw.regiao_id ?? undefined,
        observacao: raw.observacao ?? undefined,
        payload: raw.payload ?? undefined,
        createdBy: raw.created_by ?? undefined,
        deletedAt: raw.deleted_at ?? undefined,
        deletedBy: raw.deleted_by ?? undefined,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static casoToPrisma(entity: CasoNotificado) {
    return {
      cliente_id: entity.clienteId,
      unidade_saude_id: entity.unidadeSaudeId,
      notificador_id: entity.notificadorId ?? null,
      doenca: entity.doenca,
      status: entity.status,
      data_inicio_sintomas: entity.dataInicioSintomas ?? null,
      data_notificacao: entity.dataNotificacao,
      logradouro_bairro: entity.logradouroBairro ?? null,
      bairro: entity.bairro ?? null,
      latitude: entity.latitude ?? null,
      longitude: entity.longitude ?? null,
      regiao_id: entity.regiaoId ?? null,
      observacao: entity.observacao ?? null,
      payload: entity.payload ?? null,
      created_by: entity.createdBy ?? null,
    };
  }

  static pushToDomain(raw: any): PushSubscription {
    return new PushSubscription(
      {
        usuarioId: raw.usuario_id,
        clienteId: raw.cliente_id,
        endpoint: raw.endpoint,
        p256dh: raw.p256dh,
        auth: raw.auth,
      },
      { id: raw.id, createdAt: raw.created_at },
    );
  }

  static esusToDomain(raw: any): ItemNotificacaoEsus {
    return new ItemNotificacaoEsus(
      {
        clienteId: raw.cliente_id,
        levantamentoItemId: raw.levantamento_item_id ?? undefined,
        tipoAgravo: raw.tipo_agravo,
        numeroNotificacao: raw.numero_notificacao ?? undefined,
        status: raw.status,
        payloadEnviado: raw.payload_enviado ?? undefined,
        respostaApi: raw.resposta_api ?? undefined,
        erroMensagem: raw.erro_mensagem ?? undefined,
        enviadoPor: raw.enviado_por ?? undefined,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }
}
