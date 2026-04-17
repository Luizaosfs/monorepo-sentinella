import { Prisma, import_log as PrismaImportLog } from '@prisma/client';
import {
  ImportLog,
  ImportLogStatus,
} from 'src/modules/import-log/entities/import-log';

export class PrismaImportLogMapper {
  static toDomain(raw: PrismaImportLog): ImportLog {
    const status = raw.status as ImportLogStatus;

    return new ImportLog(
      {
        clienteId: raw.cliente_id,
        criadoPor: raw.criado_por || undefined,
        filename: raw.filename,
        totalLinhas: raw.total_linhas,
        importados: raw.importados,
        comErro: raw.com_erro,
        ignorados: raw.ignorados,
        duplicados: raw.duplicados,
        geocodificados: raw.geocodificados,
        geoFalhou: raw.geo_falhou,
        status,
        erros:
          raw.erros !== null && typeof raw.erros === 'object'
            ? (raw.erros as object)
            : undefined,
        finishedAt: raw.finished_at || undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.created_at,
      },
    );
  }

  static toPrismaCreate(entity: ImportLog): Prisma.import_logUncheckedCreateInput {
    return {
      cliente_id: entity.clienteId,
      criado_por: entity.criadoPor ?? null,
      filename: entity.filename,
      total_linhas: entity.totalLinhas,
      importados: entity.importados,
      com_erro: entity.comErro,
      ignorados: entity.ignorados,
      duplicados: entity.duplicados,
      geocodificados: entity.geocodificados,
      geo_falhou: entity.geoFalhou,
      status: entity.status,
      erros:
        entity.erros !== undefined
          ? (entity.erros as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      finished_at: entity.finishedAt ?? null,
    };
  }
}
