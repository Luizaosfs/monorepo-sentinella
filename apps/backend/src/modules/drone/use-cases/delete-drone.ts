import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { DroneException } from '../errors/drone.exception';
import { DroneReadRepository } from '../repositories/drone-read.repository';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class DeleteDrone {
  constructor(
    private readRepository: DroneReadRepository,
    private writeRepository: DroneWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string): Promise<void> {
    const drone = await this.readRepository.findDroneById(id);
    if (!drone) throw DroneException.notFound();

    const user = this.req['user'] as AuthenticatedUser | undefined;
    const tenantId = getAccessScope(this.req).tenantId ?? undefined;
    if (!user?.isPlatformAdmin && drone.clienteId !== tenantId) {
      throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
    }

    await this.writeRepository.deleteDrone(id, drone.clienteId);
  }
}
