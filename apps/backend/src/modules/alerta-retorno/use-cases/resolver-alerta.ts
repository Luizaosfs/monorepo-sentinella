import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

@Injectable()
export class ResolverAlerta {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, clienteId: string) {
    const alerta = await this.prisma.client.alerta_retorno_imovel.findFirst({
      where: { id, cliente_id: clienteId },
    });

    if (!alerta) throw new NotFoundException('Alerta não encontrado');

    const user = this.req['user'] as AuthenticatedUser;
    const isPrivileged = user.isPlatformAdmin || user.papeis.includes('supervisor');

    if (!isPrivileged && alerta.agente_id && alerta.agente_id !== user.id) {
      throw new ForbiddenException('Acesso negado a este recurso');
    }

    await this.prisma.client.alerta_retorno_imovel.update({
      where: { id },
      data: { resolvido: true, resolvido_em: new Date() },
    });

    return { resolved: true };
  }
}
