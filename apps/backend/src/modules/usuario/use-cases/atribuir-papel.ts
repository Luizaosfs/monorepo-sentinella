import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import type { AuthenticatedUser } from '@/guards/auth.guard';
import type { PapelApp } from '@/decorators/roles.decorator';

import { UsuarioException } from '../errors/usuario.exception';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';
import { UsuarioWriteRepository } from '../repositories/usuario-write.repository';

const PAPEIS_QUE_REQUEREM_CLIENTE: PapelApp[] = ['supervisor', 'agente', 'notificador'];

@Injectable({ scope: Scope.REQUEST })
export class AtribuirPapel {
  constructor(
    private readRepository: UsuarioReadRepository,
    private writeRepository: UsuarioWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(userId: string, papel: PapelApp): Promise<void> {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException(
        'Apenas administrador da plataforma pode atribuir papéis',
      );
    }

    const target = await this.readRepository.findAuthIdAndClienteIdById(userId);
    if (!target) throw UsuarioException.notFound();

    const { authId, clienteId } = target;

    // G.5 — paridade com fn_validar_admin_sem_cliente
    if (papel === 'admin' && clienteId !== null) {
      throw new BadRequestException(
        'papel admin não pode ter cliente_id preenchido. Admin é cross-tenant. Remova o cliente_id do usuário antes de atribuir papel admin.',
      );
    }
    if (PAPEIS_QUE_REQUEREM_CLIENTE.includes(papel) && clienteId === null) {
      throw new BadRequestException(
        `papel ${papel} requer cliente_id. Vincule o usuário a um cliente antes de atribuir este papel.`,
      );
    }
    // analista_regional fora da regra — paridade SQL legado

    const jaTem = await this.readRepository.usuarioTemPapel(authId, papel);
    if (jaTem) return;

    await this.writeRepository.atribuirPapel(authId, papel);
  }
}
