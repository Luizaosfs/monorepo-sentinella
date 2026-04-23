import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class EnfileirarScoreImovel {
  private readonly logger = new Logger(EnfileirarScoreImovel.name);

  constructor(private prisma: PrismaService) {}

  async enfileirarPorImovel(imovelId: string, clienteId: string): Promise<void> {
    try {
      await this.prisma.client.job_queue.create({
        data: {
          tipo: 'recalcular_score_imovel',
          payload: { imovelId, clienteId },
        },
      });
    } catch (err) {
      this.logger.error(
        `enfileirarPorImovel falhou: imovel=${imovelId} ${(err as Error).message}`,
      );
    }
  }

  async enfileirarPorCaso(casoId: string, clienteId: string): Promise<void> {
    try {
      await this.prisma.client.job_queue.create({
        data: {
          tipo: 'recalcular_score_por_caso',
          payload: { casoId, clienteId },
        },
      });
    } catch (err) {
      this.logger.error(
        `enfileirarPorCaso falhou: caso=${casoId} ${(err as Error).message}`,
      );
    }
  }
}
