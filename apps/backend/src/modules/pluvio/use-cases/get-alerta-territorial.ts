import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  AlertaTerritorialItem,
  AlertaTerritorialResponse,
  NivelRisco,
  calcularSeveridadeGeral,
  gerarJustificativas,
  gerarRecomendacao,
} from '../view-model/alerta-territorial.vm';

type RawRow = {
  bairro_id: string;
  regiao_nome: string;
  nivel_risco: string;
  chuva_24h: number;
  chuva_72h: number;
  chuva_7d: number;
  tendencia: string | null;
  situacao_ambiental: string | null;
  dt_ref: string;
};

const NIVEIS_ALERTA = new Set<NivelRisco>(['medio', 'alto', 'critico']);

@Injectable()
export class GetAlertaTerritorial {
  constructor(private readonly prisma: PrismaService) {}

  async execute(clienteId: string): Promise<AlertaTerritorialResponse> {
    // DISTINCT ON (bairro_id) + ORDER BY dt_ref DESC = último registro por região
    const rows = await this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT DISTINCT ON (pr.bairro_id)
        pr.bairro_id,
        r.nome              AS regiao_nome,
        pr.nivel_risco,
        pr.chuva_24h::float AS chuva_24h,
        pr.chuva_72h::float AS chuva_72h,
        pr.chuva_7d::float  AS chuva_7d,
        pr.tendencia,
        pr.situacao_ambiental,
        pr.dt_ref::text
      FROM pluvio_risco pr
      JOIN bairros r
        ON r.id = pr.bairro_id AND r.deleted_at IS NULL
      WHERE pr.cliente_id = ${clienteId}::uuid
        AND r.cliente_id  = ${clienteId}::uuid
      ORDER BY pr.bairro_id, pr.dt_ref DESC
    `);

    const SEV: Record<NivelRisco, number> = { critico: 3, alto: 2, medio: 1, baixo: 0 };

    const alertas: AlertaTerritorialItem[] = rows
      .filter((r) => NIVEIS_ALERTA.has(r.nivel_risco as NivelRisco))
      .map((r) => {
        const c24 = Number(r.chuva_24h);
        const c72 = Number(r.chuva_72h);
        const c7d = Number(r.chuva_7d);
        const nivel = r.nivel_risco as NivelRisco;
        return {
          regiaoId: r.bairro_id,
          regiaoNome: r.regiao_nome,
          nivelRiscoPluvio: nivel,
          chuva24hMm: c24,
          chuva72hMm: c72,
          chuva7dMm: c7d,
          tendencia: r.tendencia,
          justificativas: gerarJustificativas({
            chuva_24h: c24,
            chuva_72h: c72,
            chuva_7d: c7d,
            tendencia: r.tendencia,
            situacao_ambiental: r.situacao_ambiental,
          }),
          recomendacao: gerarRecomendacao(nivel),
        };
      })
      .sort((a, b) => SEV[b.nivelRiscoPluvio] - SEV[a.nivelRiscoPluvio]);

    return {
      atualizadoEm: new Date().toISOString(),
      totalRegioesMonitoradas: rows.length,
      totalRegioesEmAlerta: alertas.length,
      severidadeGeral: calcularSeveridadeGeral(alertas.map((a) => a.nivelRiscoPluvio)),
      alertas,
    };
  }
}
