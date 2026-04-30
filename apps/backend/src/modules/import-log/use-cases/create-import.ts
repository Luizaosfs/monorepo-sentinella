import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { CreateImportLogBody } from '../dtos/create-import-log.body';
import { ImportLog } from '../entities/import-log';
import { ImportLogException } from '../errors/import-log.exception';
import { ImportLogWriteRepository } from '../repositories/import-log-write.repository';

@Injectable()
export class CreateImport {
  constructor(
    private repository: ImportLogWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: CreateImportLogBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId;

    if (!clienteId) {
      throw ImportLogException.clienteIdRequired();
    }

    const userId = this.req['user']?.id as string | undefined;

    const entity = new ImportLog(
      {
        clienteId,
        criadoPor: userId,
        filename: input.filename,
        totalLinhas: input.totalLinhas,
        importados: input.importados,
        comErro: input.comErro,
        ignorados: input.ignorados,
        duplicados: input.duplicados,
        geocodificados: input.geocodificados,
        geoFalhou: input.geoFalhou,
        status: input.status,
        erros: input.erros as object | undefined,
        finishedAt: input.finishedAt,
      },
      { createdBy: userId },
    );

    const created = await this.repository.create(entity);

    return { importLog: created };
  }
}
