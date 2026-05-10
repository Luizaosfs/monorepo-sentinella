import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { OpenMeteoService, OpenMeteoStormData } from '../services/open-meteo.service';

const DAY_LABELS = ['Hoje', 'Amanhã', 'D+2', 'D+3'] as const;

// TTL 10 min — troca razoável entre freshness e custo de chamada Open Meteo.
// Limitação: cache em memória é por instância de processo. Em deploy multi-pod,
// cada pod tem cache próprio (sem compartilhamento). Resolver com Redis se necessário.
const CACHE_TTL_MS = 10 * 60 * 1_000;

export interface StormForecastAlert {
  regiaoId: string;
  regiao: string;
  type: string;
  severity: 'moderado' | 'alto' | 'critico';
  message: string;
  day: string;
  atualizadoEm: string;
}

@Injectable()
export class GetStormForecast {
  private readonly logger = new Logger(GetStormForecast.name);
  private readonly cache = new Map<string, { data: StormForecastAlert[]; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly openMeteo: OpenMeteoService,
  ) {}

  async execute(clienteId: string): Promise<StormForecastAlert[]> {
    const cached = this.cache.get(clienteId);
    if (cached && Date.now() < cached.expiresAt) {
      this.logger.debug(`[storm-forecast] cache hit clienteId=${clienteId}`);
      return cached.data;
    }
    this.logger.debug(`[storm-forecast] cache miss clienteId=${clienteId}`);

    const regioes = await this.prisma.client.bairros.findMany({
      where: { cliente_id: clienteId, deleted_at: null },
      select: { id: true, nome: true, latitude: true, longitude: true },
    });

    const withCoords = regioes.filter((r) => r.latitude != null && r.longitude != null);
    const start = Date.now();

    this.logger.log(
      `[storm-forecast] iniciando clienteId=${clienteId} regioes=${withCoords.length} sem-coords=${regioes.length - withCoords.length}`,
    );

    const settled = await Promise.allSettled(
      withCoords.map(async (reg) => {
        const data = await this.openMeteo.fetchStormForecast(reg.latitude!, reg.longitude!);
        if (!data) return [] as StormForecastAlert[];
        return this.classifyAlerts(reg.id, reg.nome, data);
      }),
    );

    const alerts: StormForecastAlert[] = [];
    let falhas = 0;
    for (const r of settled) {
      if (r.status === 'rejected') { falhas++; continue; }
      alerts.push(...r.value);
    }

    const sevOrder: Record<string, number> = { critico: 0, alto: 1, moderado: 2 };
    alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    this.logger.log(
      `[storm-forecast] concluido clienteId=${clienteId} alertas=${alerts.length} falhas=${falhas} ms=${Date.now() - start}`,
    );

    this.cache.set(clienteId, { data: alerts, expiresAt: Date.now() + CACHE_TTL_MS });
    return alerts;
  }

  private classifyAlerts(
    regiaoId: string,
    regiaoNome: string,
    data: OpenMeteoStormData,
  ): StormForecastAlert[] {
    const alerts: StormForecastAlert[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < Math.min(data.precipitacaoDias.length, 4); i++) {
      const mm = data.precipitacaoDias[i] ?? 0;
      if (mm < 10) continue;

      alerts.push({
        regiaoId,
        regiao: regiaoNome,
        type: mm >= 50 ? 'Tempestade forte' : mm >= 20 ? 'Chuva intensa' : 'Chuva moderada',
        severity: mm >= 50 ? 'critico' : mm >= 20 ? 'alto' : 'moderado',
        message: `${mm.toFixed(1)}mm previstos — ${DAY_LABELS[i]}`,
        day: DAY_LABELS[i],
        atualizadoEm: now,
      });
    }

    const vento = data.ventoDias[0] ?? 0;
    if (vento >= 60) {
      alerts.push({
        regiaoId,
        regiao: regiaoNome,
        type: 'Vendaval',
        severity: vento >= 90 ? 'critico' : 'alto',
        message: `Vento de ${vento.toFixed(0)} km/h previsto — Hoje`,
        day: 'Hoje',
        atualizadoEm: now,
      });
    }

    return alerts;
  }
}
