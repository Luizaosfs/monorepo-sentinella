import { Prisma } from '@prisma/client';
import {
  Levantamento,
  LevantamentoItem,
  LevantamentoItemDetecao,
  LevantamentoItemEvidencia,
} from 'src/modules/levantamento/entities/levantamento';

type RawDetecao = {
  id: string;
  levantamento_item_id: string;
  ordem: number;
  class_name: string;
  confidence: number | null;
  bbox_xyxy: unknown;
  bbox_norm: unknown;
  created_at: Date;
};

type RawEvidencia = {
  id: string;
  item_id: string;
  tipo: string | null;
  url: string;
  public_id: string | null;
  created_at: Date;
};

type RawItem = {
  id: string;
  levantamento_id: string;
  cliente_id: string | null;
  arquivo: string | null;
  latitude: number | null;
  longitude: number | null;
  item: string | null;
  risco: string | null;
  peso: number | null;
  acao: string | null;
  score_final: number | null;
  prioridade: string | null;
  sla_horas: number | null;
  endereco_curto: string | null;
  endereco_completo: string | null;
  maps: string | null;
  waze: string | null;
  data_hora: Date | null;
  payload: unknown;
  created_at: Date;
  updated_at: Date;
  image_url: string | null;
  uuid_img: string | null;
  id_drone: string | null;
  altitude_m: number | null;
  altura_relativa_m: number | null;
  focal_mm: number | null;
  iso: number | null;
  exposure_s: number | null;
  resolucao_largura_px: number | null;
  resolucao_altura_px: number | null;
  megapixels: number | null;
  inclinacao_camera_graus: number | null;
  direcao_yaw_graus: number | null;
  inclinacao_lateral_roll_graus: number | null;
  inclinacao_frontal_pitch_graus: number | null;
  detection_bbox: unknown;
  updated_by: string | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  image_public_id: string | null;
  detecoes?: RawDetecao[];
  evidencias?: RawEvidencia[];
};

type RawLevantamento = {
  id: string;
  cliente_id: string;
  planejamento_id: string | null;
  ciclo_id: string | null;
  id_drone: string | null;
  usuario_id: string;
  titulo: string | null;
  tipo_entrada: string | null;
  config_fonte: string | null;
  data_voo: Date | null;
  status_processamento: string | null;
  total_itens: number;
  observacao: string | null;
  created_at: Date;
  updated_at: Date;
  concluido_em: Date | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  itens?: RawItem[];
};

export class PrismaLevantamentoMapper {
  static detecaoToDomain(raw: RawDetecao): LevantamentoItemDetecao {
    return {
      id: raw.id,
      levantamentoItemId: raw.levantamento_item_id,
      ordem: raw.ordem,
      className: raw.class_name,
      confidence: raw.confidence ?? undefined,
      bboxXyxy: raw.bbox_xyxy as Record<string, unknown> | undefined,
      bboxNorm: raw.bbox_norm as Record<string, unknown> | undefined,
      createdAt: raw.created_at,
    };
  }

  static evidenciaToDomain(raw: RawEvidencia): LevantamentoItemEvidencia {
    return {
      id: raw.id,
      itemId: raw.item_id,
      tipo: raw.tipo ?? undefined,
      url: raw.url,
      publicId: raw.public_id ?? undefined,
      createdAt: raw.created_at,
    };
  }

  static itemToDomain(raw: RawItem): LevantamentoItem {
    return {
      id: raw.id,
      levantamentoId: raw.levantamento_id,
      clienteId: raw.cliente_id ?? undefined,
      arquivo: raw.arquivo ?? undefined,
      latitude: raw.latitude ?? undefined,
      longitude: raw.longitude ?? undefined,
      item: raw.item ?? undefined,
      risco: raw.risco ?? undefined,
      peso: raw.peso ?? undefined,
      acao: raw.acao ?? undefined,
      scoreFinal: raw.score_final ?? undefined,
      prioridade: raw.prioridade ?? undefined,
      slaHoras: raw.sla_horas ?? undefined,
      enderecoCurto: raw.endereco_curto ?? undefined,
      enderecoCompleto: raw.endereco_completo ?? undefined,
      maps: raw.maps ?? undefined,
      waze: raw.waze ?? undefined,
      dataHora: raw.data_hora ?? undefined,
      payload: raw.payload as Record<string, unknown> | undefined,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      imageUrl: raw.image_url ?? undefined,
      uuidImg: raw.uuid_img ?? undefined,
      idDrone: raw.id_drone ?? undefined,
      altitudeM: raw.altitude_m ?? undefined,
      alturaRelativaM: raw.altura_relativa_m ?? undefined,
      focalMm: raw.focal_mm ?? undefined,
      iso: raw.iso ?? undefined,
      exposureS: raw.exposure_s ?? undefined,
      resolucaoLarguraPx: raw.resolucao_largura_px ?? undefined,
      resolucaoAlturaPx: raw.resolucao_altura_px ?? undefined,
      megapixels: raw.megapixels ?? undefined,
      inclinacaoCameraGraus: raw.inclinacao_camera_graus ?? undefined,
      direcaoYawGraus: raw.direcao_yaw_graus ?? undefined,
      inclinacaoLateralRollGraus: raw.inclinacao_lateral_roll_graus ?? undefined,
      inclinacaoFrontalPitchGraus: raw.inclinacao_frontal_pitch_graus ?? undefined,
      detectionBbox: raw.detection_bbox as Record<string, unknown> | undefined,
      updatedBy: raw.updated_by ?? undefined,
      deletedAt: raw.deleted_at ?? undefined,
      deletedBy: raw.deleted_by ?? undefined,
      imagePublicId: raw.image_public_id ?? undefined,
      detecoes: raw.detecoes?.map(PrismaLevantamentoMapper.detecaoToDomain),
      evidencias: raw.evidencias?.map(PrismaLevantamentoMapper.evidenciaToDomain),
    };
  }

  static toDomain(raw: RawLevantamento): Levantamento {
    return new Levantamento(
      {
        clienteId: raw.cliente_id,
        planejamentoId: raw.planejamento_id ?? undefined,
        cicloId: raw.ciclo_id ?? undefined,
        idDrone: raw.id_drone ?? undefined,
        usuarioId: raw.usuario_id,
        titulo: raw.titulo ?? undefined,
        tipoEntrada: raw.tipo_entrada ?? undefined,
        configFonte: raw.config_fonte ?? undefined,
        dataVoo: raw.data_voo ?? undefined,
        statusProcessamento: raw.status_processamento ?? 'aguardando',
        totalItens: raw.total_itens,
        observacao: raw.observacao ?? undefined,
        concluidoEm: raw.concluido_em ?? undefined,
        deletedAt: raw.deleted_at ?? undefined,
        deletedBy: raw.deleted_by ?? undefined,
        itens: raw.itens?.map(PrismaLevantamentoMapper.itemToDomain),
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrisma(entity: Levantamento) {
    return {
      cliente_id: entity.clienteId,
      planejamento_id: entity.planejamentoId ?? null,
      ciclo_id: entity.cicloId ?? null,
      id_drone: entity.idDrone ?? null,
      usuario_id: entity.usuarioId,
      titulo: entity.titulo ?? null,
      tipo_entrada: entity.tipoEntrada ?? null,
      config_fonte: entity.configFonte ?? null,
      data_voo: entity.dataVoo ?? null,
      status_processamento: entity.statusProcessamento,
      total_itens: entity.totalItens,
      observacao: entity.observacao ?? null,
      concluido_em: entity.concluidoEm ?? null,
      updated_at: new Date(),
    };
  }

  static itemToPrisma(item: LevantamentoItem) {
    return {
      levantamento_id: item.levantamentoId!,
      cliente_id: item.clienteId ?? null,
      arquivo: item.arquivo ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      item: item.item ?? null,
      risco: item.risco ?? null,
      peso: item.peso ?? null,
      acao: item.acao ?? null,
      score_final: item.scoreFinal ?? null,
      prioridade: item.prioridade ?? null,
      sla_horas: item.slaHoras ?? null,
      endereco_curto: item.enderecoCurto ?? null,
      endereco_completo: item.enderecoCompleto ?? null,
      maps: item.maps ?? null,
      waze: item.waze ?? null,
      data_hora: item.dataHora ?? null,
      payload: (item.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      image_url: item.imageUrl ?? null,
      uuid_img: item.uuidImg ?? null,
      id_drone: item.idDrone ?? null,
      altitude_m: item.altitudeM ?? null,
      altura_relativa_m: item.alturaRelativaM ?? null,
      focal_mm: item.focalMm ?? null,
      iso: item.iso ?? null,
      exposure_s: item.exposureS ?? null,
      resolucao_largura_px: item.resolucaoLarguraPx ?? null,
      resolucao_altura_px: item.resolucaoAlturaPx ?? null,
      megapixels: item.megapixels ?? null,
      inclinacao_camera_graus: item.inclinacaoCameraGraus ?? null,
      direcao_yaw_graus: item.direcaoYawGraus ?? null,
      inclinacao_lateral_roll_graus: item.inclinacaoLateralRollGraus ?? null,
      inclinacao_frontal_pitch_graus: item.inclinacaoFrontalPitchGraus ?? null,
      detection_bbox: (item.detectionBbox ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      image_public_id: item.imagePublicId ?? null,
    };
  }
}
