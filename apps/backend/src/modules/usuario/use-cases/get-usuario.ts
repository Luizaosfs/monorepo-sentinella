import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';

@Injectable()
export class GetUsuario {
  constructor(
    private readRepository: UsuarioReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();
    assertTenantOwnership(usuario.clienteId, this.req);
    return { usuario };
  }
}
