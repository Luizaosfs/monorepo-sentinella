import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

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

  private assertTenant(clienteId: string | undefined): void {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (user?.isPlatformAdmin) return;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!tenantId || clienteId !== tenantId) {
      throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
    }
  }

  async execute(id: string, input: SaveUsuarioBody) {
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();
    this.assertTenant(usuario.clienteId);

    if (input.nome !== undefined) usuario.nome = input.nome;
    if (input.ativo !== undefined) usuario.ativo = input.ativo;
    if (input.papeis !== undefined) usuario.papeis = input.papeis as PapelApp[];

    await this.writeRepository.save(usuario);
    return { usuario };
  }
}
