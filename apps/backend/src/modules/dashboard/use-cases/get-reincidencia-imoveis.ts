import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetReincidenciaImoveis {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH cadeia_focos AS (
        SELECT
          fr.cliente_id,
          fr.imovel_id,
          COUNT(fr.id)                                                                       AS total_focos_historico,
          COUNT(fr.id) FILTER (WHERE fr.foco_anterior_id IS NOT NULL)                       AS focos_reincidentes,
          MAX(fr.created_at)                                                                 AS ultimo_foco_em,
          MIN(fr.created_at)                                                                 AS primeiro_foco_em,
          COUNT(fr.id) FILTER (WHERE fr.status NOT IN ('resolvido','descartado'))            AS focos_ativos,
          COUNT(DISTINCT fr.ciclo)                                                           AS ciclos_com_foco,
          ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(fr.created_at))) / 86400.0)                 AS dias_desde_ultimo_foco,
          ROUND(COUNT(fr.id) FILTER (WHERE fr.status = 'resolvido')::numeric
            / NULLIF(COUNT(fr.id), 0) * 100, 1)                                             AS taxa_resolucao_pct,
          ARRAY_AGG(DISTINCT fr.origem_tipo) FILTER (WHERE fr.origem_tipo IS NOT NULL)      AS origens
        FROM focos_risco fr
        WHERE fr.cliente_id = ${clienteId}::uuid
          AND fr.imovel_id IS NOT NULL
          AND fr.deleted_at IS NULL
        GROUP BY fr.cliente_id, fr.imovel_id
        HAVING COUNT(fr.id) >= 2
      ),
      larvicida AS (
        SELECT DISTINCT v.imovel_id
        FROM vistorias v
        JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
        WHERE v.cliente_id = ${clienteId}::uuid
          AND v.deleted_at IS NULL
          AND vd.usou_larvicida = true
          AND vd.deleted_at IS NULL
      ),
      acesso AS (
        SELECT
          v.imovel_id,
          COUNT(*) FILTER (WHERE v.acesso_realizado = false)                     AS tentativas_sem_acesso,
          MAX(v.checkin_em) FILTER (WHERE v.acesso_realizado = true)             AS ultima_vistoria_com_acesso
        FROM vistorias v
        WHERE v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
        GROUP BY v.imovel_id
      ),
      dep_pred AS (
        SELECT DISTINCT ON (v.imovel_id) v.imovel_id, vd.tipo AS deposito_predominante
        FROM vistorias v
        JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
        WHERE v.cliente_id = ${clienteId}::uuid
          AND v.deleted_at IS NULL
          AND vd.qtd_com_focos > 0
          AND vd.deleted_at IS NULL
        GROUP BY v.imovel_id, vd.tipo
        ORDER BY v.imovel_id, COUNT(*) DESC
      )
      SELECT
        cf.cliente_id,
        cf.imovel_id,
        im.logradouro,
        im.numero,
        im.bairro,
        im.quarteirao,
        im.regiao_id,
        im.latitude,
        im.longitude,
        im.historico_recusa,
        im.prioridade_drone,
        cf.total_focos_historico,
        cf.focos_reincidentes,
        cf.focos_ativos,
        cf.ultimo_foco_em,
        cf.primeiro_foco_em,
        cf.ciclos_com_foco,
        cf.dias_desde_ultimo_foco,
        cf.taxa_resolucao_pct,
        cf.origens,
        COALESCE(ac.tentativas_sem_acesso, 0)       AS tentativas_sem_acesso,
        ac.ultima_vistoria_com_acesso,
        (lv.imovel_id IS NOT NULL)                  AS usou_larvicida_alguma_vez,
        dp.deposito_predominante,
        CASE
          WHEN cf.total_focos_historico >= 5 AND cf.focos_reincidentes >= 3 THEN 'cronico'
          WHEN cf.total_focos_historico >= 3 AND cf.focos_reincidentes >= 1 THEN 'recorrente'
          ELSE 'pontual'
        END                                         AS padrao,
        ROUND(cf.focos_reincidentes::numeric / NULLIF(cf.total_focos_historico, 0) * 100, 1)
                                                    AS indice_reincidencia_pct
      FROM cadeia_focos cf
      JOIN imoveis im ON im.id = cf.imovel_id AND im.deleted_at IS NULL
      LEFT JOIN larvicida lv ON lv.imovel_id = cf.imovel_id
      LEFT JOIN acesso ac ON ac.imovel_id = cf.imovel_id
      LEFT JOIN dep_pred dp ON dp.imovel_id = cf.imovel_id
      ORDER BY cf.total_focos_historico DESC, cf.ultimo_foco_em DESC
    `)
  }
}
