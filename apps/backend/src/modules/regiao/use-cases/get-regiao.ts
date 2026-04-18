import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';

@Injectable()
export class GetRegiao {
  constructor(
    private repository: RegiaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  private assertTenant(clienteId: string | undefined): void {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (user?.isPlatformAdmin) return;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!tenantId || clienteId !== tenantId) {
      throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
    }
  }

  async execute(id: string) {
    const regiao = await this.repository.findById(id);
    if (!regiao) throw RegiaoException.notFound();
    this.assertTenant(regiao.clienteId);
    return { regiao };
  }
}
