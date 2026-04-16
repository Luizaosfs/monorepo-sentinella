import { baseAuditToHttp } from '@shared/view-model/base-audit';

import { ImportLog } from '../entities/import-log';

export class ImportLogViewModel {
  static toHttp(log: ImportLog) {
    return {
      id: log.id,
      clienteId: log.clienteId,
      criadoPor: log.criadoPor,
      filename: log.filename,
      totalLinhas: log.totalLinhas,
      importados: log.importados,
      comErro: log.comErro,
      ignorados: log.ignorados,
      duplicados: log.duplicados,
      geocodificados: log.geocodificados,
      geoFalhou: log.geoFalhou,
      status: log.status,
      erros: log.erros,
      createdAt: log.createdAt,
      finishedAt: log.finishedAt,
      ...baseAuditToHttp(log),
    };
  }
}
