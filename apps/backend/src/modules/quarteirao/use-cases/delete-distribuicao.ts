import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable()
export class DeleteDistribuicao {
  constructor(
    private readRepository: QuarteiraoReadRepository,
    private writeRepository: QuarteiraoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string) {
    const row = await this.readRepository.findDistribuicaoById(id);
    if (!row) {
      throw QuarteiraoException.distribuicaoNotFound();
    }

    this.assertTenant(row.clienteId);

    await this.writeRepository.deleteDistribuicao(id);
    return { id };
  }

  private assertTenant(clienteId: string) {
    const user = this.req['user'];
    if (user?.isPlatformAdmin) return;
    if (clienteId !== this.req['tenantId']) {
      throw QuarteiraoException.forbiddenTenant();
    }
  }
}
