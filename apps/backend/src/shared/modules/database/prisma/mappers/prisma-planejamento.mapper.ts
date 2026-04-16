import { Planejamento } from 'src/modules/planejamento/entities/planejamento';

type RawPlanejamento = {
  id: string;
  descricao: string | null;
  data_planejamento: Date;
  cliente_id: string | null;
  area_total: any | null;
  altura_voo: any | null;
  created_at: Date;
  updated_at: Date;
  tipo: string | null;
  ativo: boolean;
  tipo_entrada: string | null;
  tipo_levantamento: string;
  regiao_id: string | null;
  deleted_at: Date | null;
  deleted_by: string | null;
};

export class PrismaPlanejamentoMapper {
  static toDomain(raw: RawPlanejamento): Planejamento {
    return new Planejamento(
      {
        descricao: raw.descricao ?? undefined,
        dataPlanejamento: raw.data_planejamento,
        clienteId: raw.cliente_id ?? undefined,
        areaTotal: raw.area_total ? Number(raw.area_total) : undefined,
        alturaVoo: raw.altura_voo ? Number(raw.altura_voo) : undefined,
        tipo: raw.tipo ?? undefined,
        ativo: raw.ativo,
        tipoEntrada: raw.tipo_entrada ?? undefined,
        tipoLevantamento: raw.tipo_levantamento,
        regiaoId: raw.regiao_id ?? undefined,
        deletedAt: raw.deleted_at ?? undefined,
        deletedBy: raw.deleted_by ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrisma(entity: Planejamento) {
    return {
      descricao: entity.descricao ?? null,
      data_planejamento: entity.dataPlanejamento,
      cliente_id: entity.clienteId ?? null,
      area_total: entity.areaTotal ?? null,
      altura_voo: entity.alturaVoo ?? null,
      tipo: entity.tipo ?? null,
      ativo: entity.ativo,
      tipo_entrada: entity.tipoEntrada ?? null,
      tipo_levantamento: entity.tipoLevantamento,
      regiao_id: entity.regiaoId ?? null,
      deleted_at: entity.deletedAt ?? null,
      deleted_by: entity.deletedBy ?? null,
      updated_at: new Date(),
    };
  }
}
