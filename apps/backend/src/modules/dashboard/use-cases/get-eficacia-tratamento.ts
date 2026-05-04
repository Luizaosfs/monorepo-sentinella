import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetEficaciaTratamento {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH focos_resolvidos AS (
        SELECT
          fr.id AS foco_id,
          fr.cliente_id,
          fr.imovel_id,
          fr.confirmado_em,
          fr.resolvido_em,
          EXTRACT(EPOCH FROM (fr.resolvido_em - fr.confirmado_em)) / 3600 AS horas_resolucao,
          EXISTS (
            SELECT 1 FROM focos_risco fr2
            WHERE fr2.imovel_id = fr.imovel_id AND fr2.cliente_id = fr.cliente_id
              AND fr2.id <> fr.id AND fr2.foco_anterior_id = fr.id
              AND fr2.created_at > fr.resolvido_em
              AND fr2.created_at <= fr.resolvido_em + INTERVAL '90 days'
              AND fr2.deleted_at IS NULL
          ) AS teve_recorrencia_90d
        FROM focos_risco fr
        WHERE fr.cliente_id = ${clienteId}::uuid
          AND fr.status = 'resolvido'
          AND fr.confirmado_em IS NOT NULL
          AND fr.resolvido_em IS NOT NULL
          AND fr.deleted_at IS NULL
      ),
      depositos_na_vistoria AS (
        SELECT
          fr.foco_id,
          fr.cliente_id,
          vd.tipo AS tipo_deposito,
          vd.usou_larvicida,
          vd.qtd_larvicida_g,
          vd.qtd_com_focos,
          vd.qtd_eliminados,
          fr.teve_recorrencia_90d
        FROM focos_resolvidos fr
        JOIN vistorias v ON v.imovel_id = fr.imovel_id
          AND v.acesso_realizado = true
          AND v.created_at >= fr.confirmado_em
          AND v.created_at <= fr.resolvido_em + INTERVAL '7 days'
          AND v.deleted_at IS NULL
        JOIN vistoria_depositos vd ON vd.vistoria_id = v.id AND vd.qtd_com_focos > 0
      )
      SELECT
        cliente_id,
        tipo_deposito,
        usou_larvicida,
        COUNT(*) AS total_casos,
        COUNT(*) FILTER (WHERE NOT teve_recorrencia_90d) AS sem_recorrencia,
        ROUND(COUNT(*) FILTER (WHERE NOT teve_recorrencia_90d)::numeric / NULLIF(COUNT(*), 0) * 100, 1)::float AS taxa_eficacia_pct,
        AVG(CASE WHEN usou_larvicida THEN qtd_larvicida_g END)::float AS larvicida_medio_g,
        ROUND(AVG(qtd_eliminados::numeric / NULLIF(qtd_com_focos, 0)) * 100, 1)::float AS taxa_eliminacao_pct
      FROM depositos_na_vistoria d
      GROUP BY cliente_id, tipo_deposito, usou_larvicida
      HAVING COUNT(*) >= 5
      ORDER BY taxa_eficacia_pct DESC
    `)
  }
}
