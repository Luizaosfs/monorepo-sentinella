import { PluvioItem, PluvioRisco, PluvioRun } from 'src/modules/pluvio/entities/pluvio';

// ── Raw types (snake_case from DB — alinhado a prisma/schema/pluvio.prisma) ──

type RawPluvioRun = {
  id: string;
  cliente_id: string;
  dt_ref: Date;
  dt_gerado: Date;
  total_bairros: number;
  created_at: Date;
};

type RawPluvioItem = {
  id: string;
  run_id: string;
  regiao_id: string | null;
  bairro_nome: string;
  classificacao_risco: string;
  chuva_24h_mm: { toNumber(): number } | number | null;
  prioridade_operacional: string;
  created_at: Date;
};

type RawPluvioRisco = {
  id: string;
  regiao_id: string;
  dt_ref: Date;
  tendencia: string | null;
  chuva_24h: { toNumber(): number } | number | null;
  situacao_ambiental: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

// ── PluvioRunMapper (pluvio_operacional_run) ─────────────────────────────────

export class PrismaPluvioRunMapper {
  static toDomain(raw: RawPluvioRun): PluvioRun {
    return new PluvioRun(
      {
        clienteId: raw.cliente_id,
        dataReferencia: raw.dt_ref,
        total: raw.total_bairros,
        status: undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.dt_gerado,
      },
    );
  }

  static toPrisma(entity: PluvioRun) {
    return {
      cliente_id: entity.clienteId,
      dt_ref: entity.dataReferencia,
      total_bairros: entity.total ?? 0,
      dt_gerado: new Date(),
    };
  }
}

// ── PluvioItemMapper (pluvio_operacional_item) ──────────────────────────────

export class PrismaPluvioItemMapper {
  static toDomain(raw: RawPluvioItem): PluvioItem {
    const chuva =
      raw.chuva_24h_mm == null
        ? 0
        : typeof raw.chuva_24h_mm === 'number'
          ? raw.chuva_24h_mm
          : raw.chuva_24h_mm.toNumber();
    return new PluvioItem(
      {
        runId: raw.run_id,
        regiaoId: raw.regiao_id ?? undefined,
        imovelId: undefined,
        precipitacao: chuva,
        nivelRisco: raw.classificacao_risco,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.created_at,
      },
    );
  }

  static toPrisma(entity: PluvioItem) {
    return {
      run_id: entity.runId,
      regiao_id: entity.regiaoId ?? null,
      bairro_nome: entity.nivelRisco || '-',
      classificacao_risco: entity.nivelRisco,
      chuva_24h_mm: entity.precipitacao,
      prioridade_operacional: 'media',
      situacao_ambiental: null,
    };
  }
}

// ── PluvioRiscoMapper (pluvio_risco) ────────────────────────────────────────

export class PrismaPluvioRiscoMapper {
  static toDomain(raw: RawPluvioRisco): PluvioRisco {
    const chuva =
      raw.chuva_24h == null
        ? 0
        : typeof raw.chuva_24h === 'number'
          ? raw.chuva_24h
          : raw.chuva_24h.toNumber();
    return new PluvioRisco(
      {
        regiaoId: raw.regiao_id,
        nivel: raw.tendencia ?? '',
        precipitacaoAcumulada: chuva,
        dataReferencia: raw.dt_ref,
        observacoes: raw.situacao_ambiental ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at ?? undefined,
        updatedAt: raw.updated_at ?? undefined,
      },
    );
  }

  static toPrisma(entity: PluvioRisco) {
    return {
      regiao_id: entity.regiaoId,
      dt_ref: entity.dataReferencia,
      tendencia: entity.nivel,
      chuva_24h: entity.precipitacaoAcumulada,
      situacao_ambiental: entity.observacoes ?? null,
      updated_at: new Date(),
    };
  }
}
