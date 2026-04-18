import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { ImportLogException } from '../errors/import-log.exception';
import { ImportLogReadRepository } from '../repositories/import-log-read.repository';

@Injectable()
export class GetImport {
  constructor(
    private repository: ImportLogReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const log = await this.repository.findById(id);

    if (!log) {
      throw ImportLogException.notFound();
    }

    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    if (!isAdmin && log.clienteId !== this.req['tenantId']) {
      throw ImportLogException.notFound();
    }

    return { importLog: log };
  }
}
