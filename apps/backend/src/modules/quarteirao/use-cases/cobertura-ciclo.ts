import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CoberturaCicloInput } from '../dtos/cobertura-ciclo.input';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';

@Injectable()
export class CoberturaCiclo {
  constructor(
    private repository: QuarteiraoReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CoberturaCicloInput) {
    const isAdmin = this.req['user']?.papeis?.includes('admin');
    if (
      input.clienteId &&
      !isAdmin &&
      input.clienteId !== this.req['tenantId']
    ) {
      throw QuarteiraoException.forbiddenTenant();
    }

    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }

    this.assertTenant(clienteId);

    return this.repository.coberturaQuarteiraoCiclo({
      clienteId,
      ciclo: input.ciclo,
    });
  }

  private assertTenant(clienteId: string) {
    const user = this.req['user'];
    if (user?.papeis?.includes('admin')) return;
    if (clienteId !== this.req['tenantId']) {
      throw QuarteiraoException.forbiddenTenant();
    }
  }
}
