import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

import { CreateUsuarioBody } from '../dtos/create-usuario.body';
import { Usuario } from '../entities/usuario';
import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '../repositories/usuario-write.repository';

@Injectable()
export class CreateUsuario {
  constructor(
    private readRepository: UsuarioReadRepository,
    private writeRepository: UsuarioWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateUsuarioBody) {
    const existente = await this.readRepository.findByEmail(
      input.email.toLowerCase().trim(),
    );

    if (existente) {
      throw UsuarioException.emailAlreadyExists();
    }

    const senhaHash = await bcrypt.hash(input.senha, 10);

    const usuario = new Usuario(
      {
        nome: input.nome,
        email: input.email.toLowerCase().trim(),
        senhaHash,
        clienteId: input.clienteId,
        ativo: true,
        onboardingConcluido: false,
        papeis: input.papeis as any,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.writeRepository.create(usuario);

    return { usuario: created };
  }
}
