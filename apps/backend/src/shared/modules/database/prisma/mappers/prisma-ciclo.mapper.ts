import { Prisma } from '@prisma/client';

import { Ciclo } from 'src/modules/ciclo/entities/ciclo';

type RawCiclo = {
  id: string;
  cliente_id: string;
  numero: number;
  ano: number;
  status: string;
  data_inicio: Date;
  data_fim_prevista: Date;
  data_fechamento: Date | null;
  meta_cobertura_pct: { toNumber(): number } | null;
  snapshot_fechamento: unknown;
  observacao_abertura: string | null;
  observacao_fechamento: string | null;
  aberto_por: string | null;
  fechado_por: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PrismaCicloMapper {
  static toDomain(raw: RawCiclo): Ciclo {
    return new Ciclo(
      {
        clienteId: raw.cliente_id,
        numero: raw.numero,
        ano: raw.ano,
        status: raw.status,
        dataInicio: raw.data_inicio,
        dataFimPrevista: raw.data_fim_prevista,
        dataFechamento: raw.data_fechamento ?? undefined,
        metaCoberturaPct: raw.meta_cobertura_pct
          ? Number(raw.meta_cobertura_pct)
          : undefined,
        snapshotFechamento: raw.snapshot_fechamento
          ? (raw.snapshot_fechamento as Record<string, unknown>)
          : undefined,
        observacaoAbertura: raw.observacao_abertura ?? undefined,
        observacaoFechamento: raw.observacao_fechamento ?? undefined,
        abertoPor: raw.aberto_por ?? undefined,
        fechadoPor: raw.fechado_por ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static toPrisma(entity: Ciclo): any {
    return {
      cliente_id: entity.clienteId,
      numero: entity.numero,
      ano: entity.ano,
      status: entity.status,
      data_inicio: entity.dataInicio,
      data_fim_prevista: entity.dataFimPrevista,
      data_fechamento: entity.dataFechamento ?? null,
      meta_cobertura_pct: entity.metaCoberturaPct ?? null,
      snapshot_fechamento:
        entity.snapshotFechamento !== undefined
          ? entity.snapshotFechamento
          : Prisma.JsonNull,
      observacao_abertura: entity.observacaoAbertura ?? null,
      observacao_fechamento: entity.observacaoFechamento ?? null,
      aberto_por: entity.abertoPor ?? null,
      fechado_por: entity.fechadoPor ?? null,
      updated_at: new Date(),
    };
  }
}
