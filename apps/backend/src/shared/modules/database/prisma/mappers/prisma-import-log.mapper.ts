import { Prisma } from '@prisma/client';
import {
  ImportLog,
  ImportLogStatus,
} from 'src/modules/import-log/entities/import-log';

type RawImportLog = {
  id: string;
  cliente_id: string;
  criado_por: string | null;
  filename: string;
  total_linhas: number;
  importados: number;
  com_erro: number;
  ignorados: number;
  duplicados: number;
  geocodificados: number;
  geo_falhou: number;
  status: string;
  erros: Prisma.JsonValue | null;
  created_at: Date;
  finished_at: Date | null;
};

export class PrismaImportLogMapper {
  static toDomain(raw: RawImportLog): ImportLog {
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

  static toPrismaCreate(entity: ImportLog) {
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
