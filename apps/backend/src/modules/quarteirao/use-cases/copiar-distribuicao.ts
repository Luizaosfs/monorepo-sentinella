import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CopiarDistribuicaoBody } from '../dtos/create-distribuicao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable()
export class CopiarDistribuicao {
  constructor(
    private repository: QuarteiraoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CopiarDistribuicaoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }

    this.assertTenant(clienteId);

    if (input.cicloOrigem === input.cicloDestino) {
      throw QuarteiraoException.badRequest();
    }

    const result = await this.repository.copiarDistribuicoesCiclo({
      clienteId,
      cicloOrigem: input.cicloOrigem,
      cicloDestino: input.cicloDestino,
    });

    return result;
  }

  private assertTenant(clienteId: string) {
    const user = this.req['user'];
    if (user?.isPlatformAdmin) return;
    if (clienteId !== this.req['tenantId']) {
      throw QuarteiraoException.forbiddenTenant();
    }
  }
}
