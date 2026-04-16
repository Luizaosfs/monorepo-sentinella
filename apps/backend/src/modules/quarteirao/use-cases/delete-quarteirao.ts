import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable()
export class DeleteQuarteirao {
  constructor(
    private readRepository: QuarteiraoReadRepository,
    private writeRepository: QuarteiraoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string) {
    const quarteirao = await this.readRepository.findQuarteiraoById(id);
    if (!quarteirao) {
      throw QuarteiraoException.notFound();
    }

    this.assertTenant(quarteirao.clienteId);

    await this.writeRepository.softDeleteQuarteirao(id, this.req['user']?.id);
    return { id };
  }

  private assertTenant(clienteId: string) {
    const user = this.req['user'];
    if (user?.papeis?.includes('admin')) return;
    if (clienteId !== this.req['tenantId']) {
      throw QuarteiraoException.forbiddenTenant();
    }
  }
}
