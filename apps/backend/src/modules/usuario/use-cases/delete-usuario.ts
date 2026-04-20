import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '../repositories/usuario-write.repository';

@Injectable()
export class DeleteUsuario {
  constructor(
    private readRepository: UsuarioReadRepository,
    private writeRepository: UsuarioWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();
    assertTenantOwnership(usuario.clienteId, this.req);
    usuario.ativo = false;
    await this.writeRepository.save(usuario);
  }
}
