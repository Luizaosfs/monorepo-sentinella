import { Job } from 'src/modules/job/entities/job';

export class PrismaJobMapper {
  static toDomain(raw: any): Job {
    return new Job(
      {
        tipo: raw.tipo,
        payload: raw.payload ?? undefined,
        status: raw.status,
        tentativas: raw.tentativas,
        erro: raw.erro ?? undefined,
        agendadoEm: raw.executar_em ?? undefined,
        iniciadoEm: raw.iniciado_em ?? undefined,
        concluidoEm: raw.concluido_em ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.criado_em,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrisma(entity: Job) {
    const data: Record<string, unknown> = {
      tipo: entity.tipo,
      status: entity.status,
      tentativas: entity.tentativas,
      erro: entity.erro ?? null,
      iniciado_em: entity.iniciadoEm ?? null,
      concluido_em: entity.concluidoEm ?? null,
    };
    if (entity.payload !== undefined) {
      data.payload = entity.payload;
    }
    if (entity.agendadoEm !== undefined) {
      data.executar_em = entity.agendadoEm;
    }
    return data;
  }
}
