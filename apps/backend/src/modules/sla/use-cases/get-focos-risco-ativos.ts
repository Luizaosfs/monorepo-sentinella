import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

const BASE_SQL = Prisma.sql`
  SELECT
    fr.*,
    i.logradouro, i.numero, i.bairro, i.quarteirao, i.tipo_imovel,
    r.nome AS regiao_nome,
    u.nome AS responsavel_nome,
    sla.prazo_final AS sla_prazo_em,
    sla.violado AS sla_violado,
    CASE
      WHEN sla.prazo_final IS NULL THEN 'sem_sla'
      WHEN sla.prazo_final < now() THEN 'vencido'
      WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10 THEN 'critico'
      WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30 THEN 'atencao'
      ELSE 'ok'
    END AS status_sla_inteligente,
    COALESCE(li.image_url, fr.payload->>'foto_url') AS origem_image_url,
    li.item AS origem_item
  FROM focos_risco fr
  LEFT JOIN imoveis i ON i.id = fr.imovel_id
  LEFT JOIN regioes r ON r.id = fr.regiao_id
  LEFT JOIN usuarios u ON u.id = fr.responsavel_id
  LEFT JOIN sla_operacional sla ON sla.foco_risco_id = fr.id AND sla.status NOT IN ('concluido','vencido')
  LEFT JOIN levantamento_itens li ON li.id = fr.origem_levantamento_item_id
  WHERE fr.status NOT IN ('resolvido','descartado') AND fr.deleted_at IS NULL
`

@Injectable()
export class GetFocosRiscoAtivos {
  constructor(private prisma: PrismaService) {}

  executeAll(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      ${BASE_SQL} AND fr.cliente_id = ${clienteId}::uuid AND status_sla_inteligente IS NOT NULL
      ORDER BY fr.created_at DESC
    `)
  }

  executeVencidos(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT * FROM (
        SELECT
          fr.*,
          i.logradouro, i.numero, i.bairro, i.quarteirao, i.tipo_imovel,
          r.nome AS regiao_nome,
          u.nome AS responsavel_nome,
          sla.prazo_final AS sla_prazo_em,
          sla.violado AS sla_violado,
          CASE
            WHEN sla.prazo_final IS NULL THEN 'sem_sla'
            WHEN sla.prazo_final < now() THEN 'vencido'
            WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10 THEN 'critico'
            WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30 THEN 'atencao'
            ELSE 'ok'
          END AS status_sla_inteligente,
          COALESCE(li.image_url, fr.payload->>'foto_url') AS origem_image_url,
          li.item AS origem_item
        FROM focos_risco fr
        LEFT JOIN imoveis i ON i.id = fr.imovel_id
        LEFT JOIN regioes r ON r.id = fr.regiao_id
        LEFT JOIN usuarios u ON u.id = fr.responsavel_id
        LEFT JOIN sla_operacional sla ON sla.foco_risco_id = fr.id AND sla.status NOT IN ('concluido','vencido')
        LEFT JOIN levantamento_itens li ON li.id = fr.origem_levantamento_item_id
        WHERE fr.cliente_id = ${clienteId}::uuid
          AND fr.status NOT IN ('resolvido','descartado')
          AND fr.deleted_at IS NULL
      ) sub
      WHERE status_sla_inteligente = 'vencido'
      ORDER BY created_at DESC
    `)
  }

  executeById(focoId: string, clienteId: string) {
    return this.prisma.client.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        fr.*,
        i.logradouro, i.numero, i.bairro, i.quarteirao, i.tipo_imovel,
        r.regiao AS regiao_nome,
        u.nome AS responsavel_nome,
        sla.prazo_final AS sla_prazo_em,
        sla.violado AS sla_violado,
        CASE
          WHEN sla.prazo_final IS NULL THEN 'sem_sla'
          WHEN sla.prazo_final < now() THEN 'vencido'
          WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10 THEN 'critico'
          WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30 THEN 'atencao'
          ELSE 'ok'
        END AS status_sla_inteligente,
        COALESCE(li.image_url, fr.payload->>'foto_url') AS origem_image_url,
        li.item AS origem_item
      FROM focos_risco fr
      LEFT JOIN imoveis i ON i.id = fr.imovel_id
      LEFT JOIN regioes r ON r.id = fr.regiao_id
      LEFT JOIN usuarios u ON u.id = fr.responsavel_id
      LEFT JOIN sla_operacional sla ON sla.foco_risco_id = fr.id AND sla.status NOT IN ('concluido','vencido')
      LEFT JOIN levantamento_itens li ON li.id = fr.origem_levantamento_item_id
      WHERE fr.id = ${focoId}::uuid AND fr.cliente_id = ${clienteId}::uuid
        AND fr.status NOT IN ('resolvido','descartado') AND fr.deleted_at IS NULL
      LIMIT 1
    `)
  }
}
