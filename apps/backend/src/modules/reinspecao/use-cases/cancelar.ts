import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CancelarReinspecaoBody } from '../dtos/create-reinspecao.body';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

@Injectable()
export class CancelarReinspecao {
  constructor(
    private readRepository: ReinspecaoReadRepository,
    private writeRepository: ReinspecaoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string, input: CancelarReinspecaoBody) {
    const r = await this.readRepository.findById(id);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    this.assertTenant(r.clienteId);

    if (r.status !== 'pendente') {
      throw ReinspecaoException.badRequest();
    }

    const isAdmin = this.req['user']?.papeis?.includes('admin');
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

  private assertTenant(clienteId: string) {
    const user = this.req['user'];
    if (user?.papeis?.includes('admin')) return;
    if (clienteId !== this.req['tenantId']) {
      throw ReinspecaoException.forbiddenTenant();
    }
  }
}
