import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { SaveUsuarioBody } from '../dtos/save-usuario.body';
import { PapelApp } from '../entities/usuario';
import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '../repositories/usuario-write.repository';
import { assertUnidadeSaudePertenceCliente } from './_helpers/assert-unidade-saude';

@Injectable()
export class SaveUsuario {
  constructor(
    private readRepository: UsuarioReadRepository,
    private writeRepository: UsuarioWriteRepository,
    @Inject(REQUEST) private req: Request,
    private prisma: PrismaService,
  ) {}

  async execute(id: string, input: SaveUsuarioBody) {
    const usuario = await this.readRepository.findById(id);
    if (!usuario) throw UsuarioException.notFound();
    assertTenantOwnership(usuario.clienteId, this.req);

    if (input.nome !== undefined) usuario.nome = input.nome;
    if (input.ativo !== undefined) usuario.ativo = input.ativo;
    if (input.papeis !== undefined) usuario.papeis = input.papeis as PapelApp[];

    // undefined = não altera; null = limpa; string = vincula (valida cliente)
    if (input.unidadeSaudeId !== undefined) {
      if (input.unidadeSaudeId === null) {
        usuario.unidadeSaudeId = undefined;
      } else {
        await assertUnidadeSaudePertenceCliente(
          this.prisma,
          input.unidadeSaudeId,
          usuario.clienteId,
        );
        usuario.unidadeSaudeId = input.unidadeSaudeId;
      }
    }

    // Notificador (após aplicar papeis) exige unidade vinculada
    if (usuario.papeis.includes('notificador') && !usuario.unidadeSaudeId) {
      throw UsuarioException.unidadeSaudeObrigatoria();
    }

    await this.writeRepository.save(usuario);
    return { usuario };
  }
}
