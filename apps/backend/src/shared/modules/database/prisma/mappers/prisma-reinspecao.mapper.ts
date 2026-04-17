import { Prisma, reinspecoes_programadas as PrismaReinspecao } from '@prisma/client';
import {
  Reinspecao,
  ReinspecaoStatus,
} from 'src/modules/reinspecao/entities/reinspecao';

export class PrismaReinspecaoMapper {
  static toDomain(raw: PrismaReinspecao): Reinspecao {
    return new Reinspecao(
      {
        clienteId: raw.cliente_id,
        focoRiscoId: raw.foco_risco_id,
        status: raw.status as ReinspecaoStatus,
        tipo: raw.tipo,
        origem: raw.origem,
        dataPrevista: raw.data_prevista,
        dataRealizada: raw.data_realizada || undefined,
        responsavelId: raw.responsavel_id || undefined,
        observacao: raw.observacao || undefined,
        resultado: raw.resultado || undefined,
        criadoPor: raw.criado_por || undefined,
        canceladoPor: raw.cancelado_por || undefined,
        motivoCancelamento: raw.motivo_cancelamento || undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrismaCreate(entity: Reinspecao): Prisma.reinspecoes_programadasUncheckedCreateInput {
    return {
      cliente_id: entity.clienteId,
      foco_risco_id: entity.focoRiscoId,
      status: entity.status,
      tipo: entity.tipo,
      origem: entity.origem,
      data_prevista: entity.dataPrevista,
      data_realizada: entity.dataRealizada ?? null,
      responsavel_id: entity.responsavelId ?? null,
      observacao: entity.observacao ?? null,
      resultado: entity.resultado ?? null,
      criado_por: entity.criadoPor ?? null,
      cancelado_por: entity.canceladoPor ?? null,
      motivo_cancelamento: entity.motivoCancelamento ?? null,
    };
  }

  static toPrismaUpdate(entity: Reinspecao): Prisma.reinspecoes_programadasUncheckedUpdateInput {
    return {
      status: entity.status,
      tipo: entity.tipo,
      origem: entity.origem,
      data_prevista: entity.dataPrevista,
      data_realizada: entity.dataRealizada ?? null,
      responsavel_id: entity.responsavelId ?? null,
      observacao: entity.observacao ?? null,
      resultado: entity.resultado ?? null,
      cancelado_por: entity.canceladoPor ?? null,
      motivo_cancelamento: entity.motivoCancelamento ?? null,
      updated_at: new Date(),
    };
  }
}
