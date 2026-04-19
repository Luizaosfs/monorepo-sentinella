import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { DroneException } from '../errors/drone.exception';
import { DroneReadRepository } from '../repositories/drone-read.repository';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class DeleteVoo {
  constructor(
    private readRepository: DroneReadRepository,
    private writeRepository: DroneWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string): Promise<void> {
    const voo = await this.readRepository.findVooById(id);
    if (!voo) throw DroneException.notFound();

    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (!user?.isPlatformAdmin) {
      const tenantId = this.req['tenantId'] as string;
      const voos = await this.readRepository.findVoos(tenantId);
      if (!voos.some(v => v.id === id)) {
        throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
      }
    }

    await this.writeRepository.deleteVoo(id);
  }
}
