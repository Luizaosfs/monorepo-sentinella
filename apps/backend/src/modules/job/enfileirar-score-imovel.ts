import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class EnfileirarScoreImovel {
  constructor(private prisma: PrismaService) {}

  async enfileirarPorImovel(imovelId: string, clienteId: string): Promise<void> {
    await this.prisma.client.job_queue.create({
      data: {
        tipo: 'recalcular_score_imovel',
        status: 'pendente',
        payload: { imovelId, clienteId },
      },
    });
  }

  async enfileirarPorCaso(casoId: string, clienteId: string): Promise<void> {
    await this.prisma.client.job_queue.create({
      data: {
        tipo: 'recalcular_score_por_caso',
        status: 'pendente',
        payload: { casoId, clienteId },
      },
    });
  }
}
