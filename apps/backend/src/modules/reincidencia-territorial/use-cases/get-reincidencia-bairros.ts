import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  BairroReincidenteDto,
  calcularCriticidadeAgregado,
  parsePeriodo,
} from '../view-model/reincidencia.vm';

type RawRow = {
  bairro: string;
  total_ocorrencias: number;
  imoveis_reincidentes: number;
  quarteiroes_reincidentes: number;
  ultimo_foco_em: Date;
};

@Injectable()
export class GetReincidenciaBairrosUc {
  constructor(private prisma: PrismaService) {}

  async execute(
    clienteId: string,
    dataInicio?: string,
    dataFim?: string,
  ): Promise<BairroReincidenteDto[]> {
    const { inicio, fim } = parsePeriodo(dataInicio, dataFim);

    const rows = await this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
      WITH imovel_stats AS (
        SELECT
          fr.imovel_id,
          i.quarteirao,
          i.bairro,
          i.quadra_id,
          COUNT(fr.id)::int   AS total_ocorrencias,
          MAX(fr.suspeita_em) AS ultimo_foco_em
        FROM focos_risco fr
        JOIN imoveis i ON i.id = fr.imovel_id AND i.deleted_at IS NULL
        WHERE fr.cliente_id = ${clienteId}::uuid
          AND fr.imovel_id IS NOT NULL
          AND fr.status <> 'descartado'
          AND fr.deleted_at IS NULL
          AND fr.suspeita_em >= ${inicio}
          AND fr.suspeita_em <= ${fim}
        GROUP BY fr.imovel_id, i.quarteirao, i.bairro, i.quadra_id
        HAVING COUNT(fr.id) >= 2
      )
      SELECT
        bairro,
        SUM(total_ocorrencias)::int                                    AS total_ocorrencias,
        COUNT(DISTINCT imovel_id)::int                                 AS imoveis_reincidentes,
        COUNT(DISTINCT COALESCE(quadra_id::text, quarteirao))::int     AS quarteiroes_reincidentes,
        MAX(ultimo_foco_em)                                            AS ultimo_foco_em
      FROM imovel_stats
      WHERE bairro IS NOT NULL
      GROUP BY bairro
      ORDER BY total_ocorrencias DESC, imoveis_reincidentes DESC
    `);

    return rows.map(r => ({
      bairro: r.bairro,
      totalOcorrencias: Number(r.total_ocorrencias),
      imoveisReincidentes: Number(r.imoveis_reincidentes),
      quarteiroesReincidentes: Number(r.quarteiroes_reincidentes),
      ultimoFocoEm: r.ultimo_foco_em.toISOString(),
      criticidade: calcularCriticidadeAgregado(Number(r.imoveis_reincidentes)),
    }));
  }
}
