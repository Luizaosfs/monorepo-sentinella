import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';

@Injectable()
export class GetReinspecao {
  constructor(
    private repository: ReinspecaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = this.req['tenantId'] as string | null;
    // MT-06: passa clienteId para o findById filtrar no banco (impede IDOR cross-tenant)
    const r = await this.repository.findById(id, tenantId);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    return { reinspecao: r };
  }
}
