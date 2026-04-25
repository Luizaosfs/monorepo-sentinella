import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

interface OpenMeteoDaily {
  time: string[];
  precipitation_sum: number[];
  temperature_2m_max: number[];
  wind_speed_10m_max: number[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
}

@Injectable()
export class PluvioSchedulerService {
  private readonly logger = new Logger(PluvioSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  async riscoDaily(): Promise<{ regioes: number; atualizadas: number }> {
    const clientes = await this.prisma.client.clientes.findMany({
      where: { deleted_at: null, ativo: true },
      select: { id: true },
    });

    const hoje = new Date().toISOString().slice(0, 10);
    let totalRegioes = 0;
    let atualizadas = 0;

    for (const cliente of clientes) {
      const regioes = await this.prisma.client.regioes.findMany({
        where: { cliente_id: cliente.id, deleted_at: null },
        select: { id: true, latitude: true, longitude: true },
      });

      for (const regiao of regioes) {
        if (!regiao.latitude || !regiao.longitude) continue;
        totalRegioes++;

        try {
          const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${regiao.latitude}&longitude=${regiao.longitude}` +
            `&daily=precipitation_sum,temperature_2m_max,wind_speed_10m_max` +
            `&past_days=7&forecast_days=3&timezone=America%2FSao_Paulo`;

          const res = await fetch(url);
          if (!res.ok) continue;

          const data: OpenMeteoResponse = await res.json() as OpenMeteoResponse;
          const precip = data.daily.precipitation_sum ?? [];

          // índices: 0-6 = últimos 7 dias, 7 = hoje, 8 = amanhã (D+1)
          const chuva24h = precip[7] ?? 0;
          const chuva72h = precip.slice(5, 8).reduce((a, b) => a + (b ?? 0), 0);
          const chuva7d = precip.slice(0, 8).reduce((a, b) => a + (b ?? 0), 0);
          const diasPosChuva = precip.slice(0, 8).filter((p) => (p ?? 0) > 1).length;
          const persistencia7d = Math.round((diasPosChuva / 7) * 100) / 100;
          const prevD1 = precip[8] ?? 0;
          const tendencia =
            prevD1 > chuva24h + 2 ? 'crescente'
            : prevD1 < chuva24h - 2 ? 'decrescente'
            : 'estavel';

          const nivelRisco =
            chuva24h > 30 || chuva72h > 60 ? 'critico'
            : chuva24h > 15 || chuva72h > 30 ? 'alto'
            : chuva7d > 50 ? 'medio'
            : 'baixo';

          const situacaoAmbiental =
            nivelRisco === 'critico' ? 'favoravel_proliferacao'
            : nivelRisco === 'alto' ? 'atencao'
            : 'normal';

          await this.prisma.client.pluvio_risco.upsert({
            where: { regiao_id_dt_ref: { regiao_id: regiao.id, dt_ref: hoje } },
            create: {
              regiao_id: regiao.id,
              cliente_id: cliente.id,
              dt_ref: hoje,
              chuva_24h: chuva24h,
              chuva_72h: chuva72h,
              chuva_7d: chuva7d,
              dias_pos_chuva: diasPosChuva,
              persistencia_7d: persistencia7d,
              tendencia,
              nivel_risco: nivelRisco,
              situacao_ambiental: situacaoAmbiental,
            },
            update: {
              chuva_24h: chuva24h,
              chuva_72h: chuva72h,
              chuva_7d: chuva7d,
              dias_pos_chuva: diasPosChuva,
              persistencia_7d: persistencia7d,
              tendencia,
              nivel_risco: nivelRisco,
              situacao_ambiental: situacaoAmbiental,
            },
          });

          atualizadas++;
        } catch (err: any) {
          this.logger.warn(`[riscoDaily] Falha regiao ${regiao.id}: ${err?.message}`);
        }
      }
    }

    this.logger.log(
      `[PluvioSchedulerService.riscoDaily] regioes=${totalRegioes} atualizadas=${atualizadas}`,
    );
    return { regioes: totalRegioes, atualizadas };
  }
}
