import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CalcularScore } from '../imovel/use-cases/calcular-score';

@Injectable()
export class ScoreWorkerService {
  private readonly logger = new Logger(ScoreWorkerService.name);

  constructor(
    private prisma: PrismaService,
    private calcularScore: CalcularScore,
  ) {}

  async processScoreJobs(): Promise<{ processados: number }> {
    const TIPOS = ['recalcular_score_imovel', 'recalcular_score_por_caso', 'recalcular_score_lote'];

    const jobs = await this.prisma.client.job_queue.findMany({
      where: { tipo: { in: TIPOS }, status: 'pendente' },
      take: 20,
    });

    let processados = 0;

    for (const job of jobs) {
      try {
        const payload = (job.payload ?? {}) as Record<string, string>;

        switch (job.tipo) {
          case 'recalcular_score_imovel': {
            const { imovelId, clienteId } = payload;
            if (imovelId && clienteId) {
              await this.calcularScore.execute(imovelId, clienteId);
            }
            break;
          }

          case 'recalcular_score_por_caso': {
            const { casoId, clienteId } = payload;
            if (!casoId || !clienteId) break;

            const caso = await this.prisma.client.casos_notificados.findUnique({
              where: { id: casoId },
              select: { latitude: true, longitude: true },
            });
            if (!caso?.latitude || !caso?.longitude) break;

            // Busca imóveis num raio de 300m (~0.003°)
            const lat = Number(caso.latitude);
            const lng = Number(caso.longitude);
            const imoveis = await this.prisma.client.imoveis.findMany({
              where: {
                cliente_id: clienteId,
                deleted_at: null,
                latitude: { gte: lat - 0.003, lte: lat + 0.003 },
                longitude: { gte: lng - 0.003, lte: lng + 0.003 },
              },
              select: { id: true },
            });

            for (const imovel of imoveis) {
              await this.calcularScore.execute(imovel.id, clienteId);
            }
            break;
          }

          case 'recalcular_score_lote': {
            const { clienteId } = payload;
            if (!clienteId) break;

            const imoveis = await this.prisma.client.imoveis.findMany({
              where: { cliente_id: clienteId, deleted_at: null },
              select: { id: true },
            });

            for (const imovel of imoveis) {
              await this.calcularScore.execute(imovel.id, clienteId);
            }
            break;
          }
        }

        processados++;
      } catch (err: any) {
        this.logger.warn(`[ScoreWorkerService] Falha job ${job.id}: ${err?.message}`);
      }
    }

    return { processados };
  }
}
