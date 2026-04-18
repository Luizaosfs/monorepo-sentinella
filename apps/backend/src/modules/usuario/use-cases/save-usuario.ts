import { Injectable } from '@nestjs/common';

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
  ) {}

  async execute(id: string, input: SaveUsuarioBody) {
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();

    if (input.nome !== undefined) usuario.nome = input.nome;
    if (input.ativo !== undefined) usuario.ativo = input.ativo;
    if (input.papeis !== undefined) usuario.papeis = input.papeis as PapelApp[];

    await this.writeRepository.save(usuario);
    return { usuario };
  }
}
