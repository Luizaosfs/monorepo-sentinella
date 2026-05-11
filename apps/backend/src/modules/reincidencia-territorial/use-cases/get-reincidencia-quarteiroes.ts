import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  QuarteiraoReincidenteDto,
  calcularCriticidadeAgregado,
  parsePeriodo,
} from '../view-model/reincidencia.vm';

type RawRow = {
  quarteirao: string;
  bairro: string | null;
  total_ocorrencias: number;
  imoveis_reincidentes: number;
  ultimo_foco_em: Date;
  quadra_id: string | null;
};

@Injectable()
export class GetReincidenciaQuarteiroesuUc {
  constructor(private prisma: PrismaService) {}

  async execute(
    clienteId: string,
    dataInicio?: string,
    dataFim?: string,
  ): Promise<QuarteiraoReincidenteDto[]> {
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
        quarteirao,
        bairro,
        quadra_id,
        SUM(total_ocorrencias)::int   AS total_ocorrencias,
        COUNT(imovel_id)::int         AS imoveis_reincidentes,
        MAX(ultimo_foco_em)           AS ultimo_foco_em
      FROM imovel_stats
      WHERE quarteirao IS NOT NULL
      GROUP BY quarteirao, bairro, COALESCE(quadra_id::text, '')
      ORDER BY total_ocorrencias DESC, imoveis_reincidentes DESC
    `);

    return rows.map(r => ({
      quarteirao: r.quarteirao,
      bairro: r.bairro,
      totalOcorrencias: Number(r.total_ocorrencias),
      imoveisReincidentes: Number(r.imoveis_reincidentes),
      ultimoFocoEm: r.ultimo_foco_em.toISOString(),
      criticidade: calcularCriticidadeAgregado(Number(r.imoveis_reincidentes)),
    }));
  }
}
