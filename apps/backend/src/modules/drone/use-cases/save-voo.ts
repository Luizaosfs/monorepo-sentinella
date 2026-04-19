import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { SaveVooBody } from '../dtos/create-drone.body';
import { Voo } from '../entities/drone';
import { DroneException } from '../errors/drone.exception';
import { DroneReadRepository } from '../repositories/drone-read.repository';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class SaveVoo {
  constructor(
    private readRepository: DroneReadRepository,
    private writeRepository: DroneWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: SaveVooBody): Promise<{ voo: Voo }> {
    const voo = await this.readRepository.findVooById(id);
    if (!voo) throw DroneException.vooNotFound();

    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (!user?.isPlatformAdmin) {
      const tenantId = this.req['tenantId'] as string;
      const voos = await this.readRepository.findVoos(tenantId);
      if (!voos.some(v => v.id === id)) {
        throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
      }
    }

    if (input.inicio !== undefined) voo.inicio = input.inicio;
    if (input.fim !== undefined) voo.fim = input.fim;
    if (input.planejamentoId !== undefined) voo.planejamentoId = input.planejamentoId;
    if (input.pilotoId !== undefined) voo.pilotoId = input.pilotoId;

    await this.writeRepository.saveVoo(voo);
    return { voo };
  }
}
