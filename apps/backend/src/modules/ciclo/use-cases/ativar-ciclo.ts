import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CicloException } from '../errors/ciclo.exception';
import { CicloReadRepository } from '../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../repositories/ciclo-write.repository';

@Injectable()
export class AtivarCiclo {
  constructor(
    private readRepository: CicloReadRepository,
    private writeRepository: CicloWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string) {
    const ciclo = await this.readRepository.findById(id);
    if (!ciclo) throw CicloException.notFound();

    // Desativa todos os ciclos do cliente antes de ativar o novo
    await this.writeRepository.desativarTodos(this.req['tenantId']);

    ciclo.status = 'ativo';
    await this.writeRepository.save(ciclo);

    return { ciclo };
  }
}
