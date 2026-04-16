import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';

@Injectable()
export class GetReinspecao {
  constructor(
    private repository: ReinspecaoReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string) {
    const r = await this.repository.findById(id);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    const isAdmin = this.req['user']?.papeis?.includes('admin');
    if (!isAdmin && r.clienteId !== this.req['tenantId']) {
      throw ReinspecaoException.forbiddenTenant();
    }

    return { reinspecao: r };
  }
}
