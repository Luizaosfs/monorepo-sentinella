import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { SaveUsuarioBody } from '../dtos/save-usuario.body';
import { PapelApp } from '../entities/usuario';
import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '../repositories/usuario-write.repository';

@Injectable()
export class SaveUsuario {
  constructor(
    private readRepository: UsuarioReadRepository,
    private writeRepository: UsuarioWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: SaveUsuarioBody) {
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();
    assertTenantOwnership(usuario.clienteId, this.req);

    if (input.nome !== undefined) usuario.nome = input.nome;
    if (input.ativo !== undefined) usuario.ativo = input.ativo;
    if (input.papeis !== undefined) usuario.papeis = input.papeis as PapelApp[];

    await this.writeRepository.save(usuario);
    return { usuario };
  }
}
