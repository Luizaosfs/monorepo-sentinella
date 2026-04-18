import { Prisma } from '@prisma/client';
import {
  Drone,
  PipelineRun,
  Voo,
  YoloFeedback,
} from 'src/modules/drone/entities/drone';

// ─── Raw types (snake_case columns) ─────────────────────────────────────────

type RawDrone = {
  id: string;
  cliente_id: string;
  nome: string;
  modelo: string | null;
  serial: string | null;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
};

type RawVoo = {
  id: string;
  planejamento_id: string | null;
  voo_numero: number | null;
  inicio: Date;
  fim: Date | null;
  duracao_min: unknown; // Decimal
  km: unknown;
  ha: unknown;
  baterias: number | null;
  fotos: number | null;
  amostra_lat: unknown;
  amostra_lon: unknown;
  amostra_data_hora: Date | null;
  amostra_arquivo: string | null;
  wx_error: string | null;
  wx_detail: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  piloto_id: string | null;
};

type RawPipelineRun = {
  id: string;
  cliente_id: string;
  voo_id: string | null;
  levantamento_id: string | null;
  status: string;
  total_imagens: number | null;
  imagens_processadas: number | null;
  itens_gerados: number | null;
  focos_criados: number | null;
  erro_mensagem: string | null;
  erro_detalhe: object | null;
  versao_pipeline: string | null;
  iniciado_em: Date;
  concluido_em: Date | null;
  created_at: Date;
};

type RawYoloFeedback = {
  id: string;
  levantamento_item_id: string;
  cliente_id: string;
  confirmado: boolean;
  observacao: string | null;
  registrado_por: string | null;
  created_at: Date;
};

// ─── Mapper ──────────────────────────────────────────────────────────────────

export class PrismaDroneMapper {
  // ── Drone ──────────────────────────────────────────────────────────────────

  static toDomain(raw: RawDrone): Drone {
    return new Drone(
      {
        clienteId: raw.cliente_id,
        nome: raw.nome,
        modelo: raw.modelo ?? undefined,
        serial: raw.serial ?? undefined,
        ativo: raw.ativo,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrisma(entity: Drone) {
    return {
      cliente_id: entity.clienteId,
      nome: entity.nome,
      modelo: entity.modelo ?? '',
      serial: entity.serial ?? null,
      ativo: entity.ativo,
      updated_at: new Date(),
    };
  }

  // ── Voo ───────────────────────────────────────────────────────────────────

  static vooToDomain(raw: RawVoo): Voo {
    return new Voo(
      {
        planejamentoId: raw.planejamento_id ?? undefined,
        vooNumero: raw.voo_numero ?? undefined,
        inicio: raw.inicio,
        fim: raw.fim ?? undefined,
        duracaoMin: raw.duracao_min ? Number(raw.duracao_min) : undefined,
        km: raw.km ? Number(raw.km) : undefined,
        ha: raw.ha ? Number(raw.ha) : undefined,
        baterias: raw.baterias ?? undefined,
        fotos: raw.fotos ?? undefined,
        amostraLat: raw.amostra_lat ? Number(raw.amostra_lat) : undefined,
        amostraLon: raw.amostra_lon ? Number(raw.amostra_lon) : undefined,
        amostraDataHora: raw.amostra_data_hora ?? undefined,
        amostraArquivo: raw.amostra_arquivo ?? undefined,
        wxError: raw.wx_error ?? undefined,
        wxDetail: raw.wx_detail ?? undefined,
        pilotoId: raw.piloto_id ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at ?? new Date(),
        updatedAt: raw.updated_at ?? new Date(),
      },
    );
  }

  static vooToPrisma(entity: Voo) {
    return {
      planejamento_id: entity.planejamentoId ?? null,
      voo_numero: entity.vooNumero ?? null,
      inicio: entity.inicio,
      fim: entity.fim ?? null,
      duracao_min: entity.duracaoMin ?? null,
      km: entity.km ?? null,
      ha: entity.ha ?? null,
      baterias: entity.baterias ?? null,
      fotos: entity.fotos ?? null,
      amostra_lat: entity.amostraLat ?? null,
      amostra_lon: entity.amostraLon ?? null,
      amostra_data_hora: entity.amostraDataHora ?? null,
      amostra_arquivo: entity.amostraArquivo ?? null,
      wx_error: entity.wxError ?? null,
      wx_detail: entity.wxDetail ?? null,
      piloto_id: entity.pilotoId ?? null,
      updated_at: new Date(),
    };
  }

  // ── PipelineRun ───────────────────────────────────────────────────────────

  static pipelineToDomain(raw: RawPipelineRun): PipelineRun {
    return new PipelineRun(
      {
        clienteId: raw.cliente_id,
        vooId: raw.voo_id ?? undefined,
        levantamentoId: raw.levantamento_id ?? undefined,
        status: raw.status,
        totalImagens: raw.total_imagens ?? undefined,
        imagensProcessadas: raw.imagens_processadas ?? undefined,
        itensGerados: raw.itens_gerados ?? undefined,
        focosCriados: raw.focos_criados ?? undefined,
        erroMensagem: raw.erro_mensagem ?? undefined,
        erroDetalhe: raw.erro_detalhe as Record<string, unknown> | undefined,
        versaoPipeline: raw.versao_pipeline ?? undefined,
        iniciadoEm: raw.iniciado_em,
        concluidoEm: raw.concluido_em ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.created_at,
      },
    );
  }

  // ── YoloFeedback ──────────────────────────────────────────────────────────

  static feedbackToDomain(raw: RawYoloFeedback): YoloFeedback {
    return new YoloFeedback(
      {
        levantamentoItemId: raw.levantamento_item_id,
        clienteId: raw.cliente_id,
        confirmado: raw.confirmado,
        observacao: raw.observacao ?? undefined,
        registradoPor: raw.registrado_por ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.created_at,
      },
    );
  }
}
