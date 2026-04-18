import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ReagendarReinspecaoBody } from '../dtos/reagendar-reinspecao.body';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

@Injectable()
export class ReagendarReinspecao {
  constructor(
    private readRepository: ReinspecaoReadRepository,
    private writeRepository: ReinspecaoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string, input: ReagendarReinspecaoBody) {
    const r = await this.readRepository.findById(id);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    this.assertTenant(r.clienteId);

    if (r.status !== 'pendente') {
      throw ReinspecaoException.badRequest();
    }

    r.dataPrevista = input.dataPrevista;

    await this.writeRepository.save(r);
    r.updatedAt = new Date();
    return { reinspecao: r };
  }

  private assertTenant(clienteId: string) {
    const user = this.req['user'];
    if (user?.isPlatformAdmin) return;
    if (clienteId !== this.req['tenantId']) {
      throw ReinspecaoException.forbiddenTenant();
    }
  }
}
