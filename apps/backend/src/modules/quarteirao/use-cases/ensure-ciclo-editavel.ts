import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { QuarteiraoException } from '../errors/quarteirao.exception';

@Injectable()
export class EnsureCicloEditavel {
  constructor(private prisma: PrismaService) {}

  async execute(cicloId: string, clienteId: string): Promise<void> {
    const ciclo = await this.prisma.client.ciclos.findFirst({
      where: { id: cicloId, cliente_id: clienteId },
      select: { status: true },
    });
    if (!ciclo) throw QuarteiraoException.badRequest();
    if (ciclo.status === 'fechado') throw QuarteiraoException.cicloFechado();
  }
}
