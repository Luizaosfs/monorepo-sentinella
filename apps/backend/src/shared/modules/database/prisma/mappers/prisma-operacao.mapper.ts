import {
  Operacao,
  OperacaoEvidencia,
} from 'src/modules/operacao/entities/operacao';

type RawEvidencia = {
  id: string;
  operacao_id: string;
  image_url: string;
  legenda: string | null;
  public_id: string | null;
  created_at: Date;
};

type RawOperacao = {
  id: string;
  cliente_id: string;
  item_id: string | null;
  status: string;
  prioridade: string | null;
  responsavel_id: string | null;
  created_at: Date;
  iniciado_em: Date | null;
  concluido_em: Date | null;
  observacao: string | null;
  tipo_vinculo: string | null;
  item_operacional_id: string | null;
  item_levantamento_id: string | null;
  regiao_id: string | null;
  foco_risco_id: string | null;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
  evidencias?: RawEvidencia[];
};

export class PrismaOperacaoMapper {
  static evidenciaToDomain(raw: RawEvidencia): OperacaoEvidencia {
    return {
      id: raw.id,
      operacaoId: raw.operacao_id,
      imageUrl: raw.image_url,
      legenda: raw.legenda ?? undefined,
      publicId: raw.public_id ?? undefined,
      createdAt: raw.created_at,
    };
  }

  static toDomain(raw: RawOperacao): Operacao {
    return new Operacao(
      {
        clienteId: raw.cliente_id,
        itemId: raw.item_id ?? undefined,
        status: raw.status,
        prioridade: raw.prioridade ?? undefined,
        responsavelId: raw.responsavel_id ?? undefined,
        iniciadoEm: raw.iniciado_em ?? undefined,
        concluidoEm: raw.concluido_em ?? undefined,
        observacao: raw.observacao ?? undefined,
        tipoVinculo: raw.tipo_vinculo ?? undefined,
        itemOperacionalId: raw.item_operacional_id ?? undefined,
        itemLevantamentoId: raw.item_levantamento_id ?? undefined,
        regiaoId: raw.regiao_id ?? undefined,
        focoRiscoId: raw.foco_risco_id ?? undefined,
        deletedAt: raw.deleted_at ?? undefined,
        deletedBy: raw.deleted_by ?? undefined,
        evidencias: raw.evidencias?.map(PrismaOperacaoMapper.evidenciaToDomain),
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrisma(entity: Operacao) {
    return {
      cliente_id: entity.clienteId,
      status: entity.status,
      prioridade: entity.prioridade ?? null,
      responsavel_id: entity.responsavelId ?? null,
      iniciado_em: entity.iniciadoEm ?? null,
      concluido_em: entity.concluidoEm ?? null,
      observacao: entity.observacao ?? null,
      tipo_vinculo: entity.tipoVinculo ?? null,
      item_operacional_id: entity.itemOperacionalId ?? null,
      item_levantamento_id: entity.itemLevantamentoId ?? null,
      regiao_id: entity.regiaoId ?? null,
      foco_risco_id: entity.focoRiscoId ?? null,
      deleted_at: entity.deletedAt ?? null,
      deleted_by: entity.deletedBy ?? null,
      updated_at: new Date(),
    };
  }

  static evidenciaToPrisma(ev: OperacaoEvidencia & { operacaoId: string }) {
    return {
      operacao_id: ev.operacaoId,
      image_url: ev.imageUrl,
      legenda: ev.legenda ?? null,
      public_id: ev.publicId ?? null,
    };
  }
}
