import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

interface FocoAgrupadoRow {
  cliente_id: string;
  agrupador_tipo: 'quadra' | 'bairro' | 'regiao' | 'item';
  agrupador_valor: string;
  quantidade_focos: number;
  quantidade_elegivel: number;
  ct_em_triagem: number;
  ct_aguarda_inspecao: number;
  ct_sem_responsavel: number;
  prioridade_max_ord: number;
  foco_ids: string[];
  lat_media: number | null;
  lng_media: number | null;
}

@Injectable()
export class GetFocosAgrupados {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<FocoAgrupadoRow[]> {
    return this.prisma.client.$queryRaw<FocoAgrupadoRow[]>(Prisma.sql`
      WITH focos AS (
        SELECT
          fr.id,
          fr.status,
          fr.prioridade,
          fr.responsavel_id,
          fr.score_prioridade,
          fr.latitude,
          fr.longitude,
          CASE
            WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN 'quadra'
            WHEN i.bairro IS NOT NULL AND i.bairro <> '' THEN 'bairro'
            WHEN r.nome IS NOT NULL AND r.nome <> '' THEN 'regiao'
            ELSE 'item'
          END AS agrupador_tipo,
          CASE
            WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN i.quarteirao
            WHEN i.bairro IS NOT NULL AND i.bairro <> '' THEN i.bairro
            WHEN r.nome IS NOT NULL AND r.nome <> '' THEN r.nome
            ELSE fr.id::text
          END AS agrupador_valor
        FROM focos_risco fr
        LEFT JOIN imoveis i ON i.id = fr.imovel_id AND i.deleted_at IS NULL
        LEFT JOIN regioes r ON r.id = fr.regiao_id
        WHERE fr.cliente_id = ${clienteId}::uuid
          AND fr.status NOT IN ('resolvido', 'descartado')
          AND fr.deleted_at IS NULL
      )
      SELECT
        ${clienteId}::text AS cliente_id,
        agrupador_tipo,
        agrupador_valor,
        COUNT(*)::int AS quantidade_focos,
        COUNT(*) FILTER (WHERE status IN ('em_triagem', 'aguarda_inspecao'))::int AS quantidade_elegivel,
        COUNT(*) FILTER (WHERE status = 'em_triagem')::int AS ct_em_triagem,
        COUNT(*) FILTER (WHERE status = 'aguarda_inspecao')::int AS ct_aguarda_inspecao,
        COUNT(*) FILTER (WHERE responsavel_id IS NULL)::int AS ct_sem_responsavel,
        MIN(CASE prioridade
          WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3
          WHEN 'P4' THEN 4 WHEN 'P5' THEN 5 ELSE 99
        END)::int AS prioridade_max_ord,
        array_agg(id ORDER BY score_prioridade DESC NULLS LAST)::text[] AS foco_ids,
        AVG(latitude)::float AS lat_media,
        AVG(longitude)::float AS lng_media
      FROM focos
      GROUP BY agrupador_tipo, agrupador_valor
      ORDER BY
        MIN(CASE prioridade
          WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3
          WHEN 'P4' THEN 4 WHEN 'P5' THEN 5 ELSE 99
        END) ASC,
        COUNT(*) DESC
    `);
  }
}
