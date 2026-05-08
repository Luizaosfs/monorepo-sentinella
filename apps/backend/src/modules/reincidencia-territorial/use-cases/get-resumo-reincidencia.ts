import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  ResumoReincidenciaDto,
  parsePeriodo,
} from '../view-model/reincidencia.vm';

type RawResumo = {
  total_ocorrencias: number;
  total_imoveis_com_foco: number;
  imoveis_reincidentes: number;
  quarteiroes_reincidentes: number;
  bairros_reincidentes: number;
  crit_baixa: number;
  crit_media: number;
  crit_alta: number;
};

@Injectable()
export class GetResumoReincidenciaUc {
  constructor(private prisma: PrismaService) {}

  async execute(
    clienteId: string,
    dataInicio?: string,
    dataFim?: string,
  ): Promise<ResumoReincidenciaDto> {
    const { inicio, fim } = parsePeriodo(dataInicio, dataFim);

    const rows = await this.prisma.client.$queryRaw<RawResumo[]>(Prisma.sql`
      WITH focos_periodo AS (
        SELECT
          fr.imovel_id,
          i.quarteirao,
          i.bairro,
          COUNT(fr.id)::int AS total_ocorrencias
        FROM focos_risco fr
        JOIN imoveis i ON i.id = fr.imovel_id AND i.deleted_at IS NULL
        WHERE fr.cliente_id = ${clienteId}::uuid
          AND fr.imovel_id IS NOT NULL
          AND fr.status <> 'descartado'
          AND fr.deleted_at IS NULL
          AND fr.suspeita_em >= ${inicio}
          AND fr.suspeita_em <= ${fim}
        GROUP BY fr.imovel_id, i.quarteirao, i.bairro
      ),
      reincidentes AS (
        SELECT * FROM focos_periodo WHERE total_ocorrencias >= 2
      )
      SELECT
        COALESCE((SELECT SUM(total_ocorrencias)::int FROM focos_periodo), 0)   AS total_ocorrencias,
        COALESCE((SELECT COUNT(*)::int      FROM focos_periodo), 0)             AS total_imoveis_com_foco,
        COALESCE((SELECT COUNT(*)::int      FROM reincidentes), 0)              AS imoveis_reincidentes,
        COALESCE((SELECT COUNT(DISTINCT quarteirao)::int FROM reincidentes WHERE quarteirao IS NOT NULL), 0) AS quarteiroes_reincidentes,
        COALESCE((SELECT COUNT(DISTINCT bairro)::int     FROM reincidentes WHERE bairro     IS NOT NULL), 0) AS bairros_reincidentes,
        COALESCE((SELECT COUNT(*) FILTER (WHERE total_ocorrencias = 2)::int  FROM reincidentes), 0) AS crit_baixa,
        COALESCE((SELECT COUNT(*) FILTER (WHERE total_ocorrencias = 3)::int  FROM reincidentes), 0) AS crit_media,
        COALESCE((SELECT COUNT(*) FILTER (WHERE total_ocorrencias >= 4)::int FROM reincidentes), 0) AS crit_alta
    `);

    const r = rows[0] ?? {
      total_ocorrencias: 0,
      total_imoveis_com_foco: 0,
      imoveis_reincidentes: 0,
      quarteiroes_reincidentes: 0,
      bairros_reincidentes: 0,
      crit_baixa: 0,
      crit_media: 0,
      crit_alta: 0,
    };

    const totalComFoco = Number(r.total_imoveis_com_foco);
    const imoveisReincidentes = Number(r.imoveis_reincidentes);

    return {
      periodo: {
        dataInicio: inicio.toISOString(),
        dataFim: fim.toISOString(),
      },
      municipio: {
        totalOcorrencias: Number(r.total_ocorrencias),
        imoveisReincidentes,
        quarteiroesReincidentes: Number(r.quarteiroes_reincidentes),
        bairrosReincidentes: Number(r.bairros_reincidentes),
        percentualReincidencia:
          totalComFoco > 0 ? Math.round((imoveisReincidentes / totalComFoco) * 100) : 0,
      },
      criticidade: {
        baixa: Number(r.crit_baixa),
        media: Number(r.crit_media),
        alta: Number(r.crit_alta),
      },
    };
  }
}
