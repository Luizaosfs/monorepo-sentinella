import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';

@Injectable()
export class GetUsuario {
  constructor(
    private readRepository: UsuarioReadRepository,
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
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();
    this.assertTenant(usuario.clienteId);
    return { usuario };
  }
}
