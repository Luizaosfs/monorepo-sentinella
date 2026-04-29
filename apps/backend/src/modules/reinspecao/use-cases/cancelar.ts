import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { CancelarReinspecaoBody } from '../dtos/create-reinspecao.body';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

@Injectable()
export class CancelarReinspecao {
  constructor(
    private readRepository: ReinspecaoReadRepository,
    private writeRepository: ReinspecaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: CancelarReinspecaoBody) {
    const tenantId = getAccessScope(this.req).tenantId;
    const r = await this.readRepository.findById(id, tenantId);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    if (r.status !== 'pendente') {
      throw ReinspecaoException.badRequest();
    }

    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    const canceladoPor =
      input.canceladoPor && isAdmin
        ? input.canceladoPor
        : this.req['user']?.id;
    if (!canceladoPor) {
      throw ReinspecaoException.payloadInvalido();
    }

    r.status = 'cancelada';
    r.motivoCancelamento = input.motivoCancelamento;
    r.canceladoPor = canceladoPor;

    await this.writeRepository.save(r);
    r.updatedAt = new Date();
    return { reinspecao: r };
  }
}
