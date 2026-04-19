import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { PlanejamentoException } from '../errors/planejamento.exception';

@Injectable()
export class VoosByPlanejamento {
  constructor(private prisma: PrismaService) {}

  async execute(planejamentoId: string, clienteId: string | null) {
    if (clienteId) {
      const p = await this.prisma.client.planejamento.findFirst({
        where: { id: planejamentoId, cliente_id: clienteId, deleted_at: null },
        select: { id: true },
      });
      if (!p) throw PlanejamentoException.notFound();
    }

    return this.prisma.client.voos.findMany({
      where: { planejamento_id: planejamentoId },
      orderBy: { inicio: 'desc' },
    });
  }
}
