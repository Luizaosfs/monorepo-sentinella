import { PlanoAcao } from '@modules/plano-acao/entities/plano-acao';

type RawPlanoAcaoCatalogo = {
  id: string;
  cliente_id: string;
  label: string;
  descricao: string | null;
  tipo_item: string | null;
  ativo: boolean;
  ordem: number;
  created_at: Date;
  updated_at: Date;
};

export class PrismaPlanoAcaoMapper {
  static toDomain(raw: RawPlanoAcaoCatalogo): PlanoAcao {
    return new PlanoAcao(
      {
        clienteId: raw.cliente_id,
        label: raw.label,
        descricao: raw.descricao || undefined,
        tipoItem: raw.tipo_item || undefined,
        ativo: raw.ativo,
        ordem: raw.ordem,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrismaCreate(entity: PlanoAcao) {
    return {
      cliente_id: entity.clienteId,
      label: entity.label,
      descricao: entity.descricao ?? null,
      tipo_item: entity.tipoItem ?? null,
      ativo: entity.ativo,
      ordem: entity.ordem,
    };
  }

  static toPrismaUpdate(entity: PlanoAcao) {
    return {
      label: entity.label,
      descricao: entity.descricao ?? null,
      tipo_item: entity.tipoItem ?? null,
      ativo: entity.ativo,
      ordem: entity.ordem,
      updated_at: new Date(),
    };
  }
}
