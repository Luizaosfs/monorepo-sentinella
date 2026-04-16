import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CreateRegiaoBody } from '../dtos/create-regiao.body';
import { Regiao } from '../entities/regiao';
import { RegiaoWriteRepository } from '../repositories/regiao-write.repository';

@Injectable()
export class CreateRegiao {
  constructor(
    private writeRepository: RegiaoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateRegiaoBody) {
    const regiao = new Regiao(
      {
        clienteId: this.req['tenantId'],
        nome: input.nome,
        tipo: input.tipo,
        cor: input.cor,
        geojson: input.geojson,
        ativo: true,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.writeRepository.create(regiao);
    return { regiao: created };
  }
}
