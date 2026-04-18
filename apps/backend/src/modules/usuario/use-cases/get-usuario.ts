import { Injectable } from '@nestjs/common';

import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';

@Injectable()
export class GetUsuario {
  constructor(private readRepository: UsuarioReadRepository) {}

  async execute(id: string) {
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();
    return { usuario };
  }
}
