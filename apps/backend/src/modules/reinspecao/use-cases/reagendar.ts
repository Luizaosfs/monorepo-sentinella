import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { ReagendarReinspecaoBody } from '../dtos/reagendar-reinspecao.body';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

@Injectable()
export class ReagendarReinspecao {
  constructor(
    private readRepository: ReinspecaoReadRepository,
    private writeRepository: ReinspecaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: ReagendarReinspecaoBody) {
    const tenantId = getAccessScope(this.req).tenantId;
    const r = await this.readRepository.findById(id, tenantId);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    if (r.status !== 'pendente') {
      throw ReinspecaoException.badRequest();
    }

    r.dataPrevista = input.dataPrevista;

    await this.writeRepository.save(r);
    r.updatedAt = new Date();
    return { reinspecao: r };
  }
}
