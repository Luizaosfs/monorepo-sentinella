import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetExecutivoKpis {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const rows = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH sla_stats AS (
        SELECT
          so.cliente_id,
          COUNT(*) FILTER (WHERE so.status = 'vencido' AND so.violado = true AND so.deleted_at IS NULL) AS slas_vencidos,
          COUNT(*) FILTER (WHERE so.deleted_at IS NULL) AS total_slas
        FROM sla_operacional so
        WHERE so.cliente_id = ${clienteId}::uuid
        GROUP BY so.cliente_id
      ),
      focos_stats AS (
        SELECT
          fr.cliente_id,
          COUNT(*) FILTER (WHERE fr.status NOT IN ('resolvido','descartado')) AS total_focos_ativos,
          COUNT(*) FILTER (WHERE fr.created_at >= CURRENT_DATE - INTERVAL '7 days') AS focos_novos_semana,
          COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE - INTERVAL '7 days') AS focos_resolvidos_semana
        FROM focos_risco fr
        WHERE fr.cliente_id = ${clienteId}::uuid AND fr.deleted_at IS NULL
        GROUP BY fr.cliente_id
      ),
      vistorias_stats AS (
        SELECT
          v.cliente_id,
          COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.acesso_realizado = true AND v.created_at >= CURRENT_DATE - INTERVAL '7 days') AS imoveis_visitados_semana,
          COUNT(DISTINCT v.agente_id) FILTER (WHERE v.created_at >= CURRENT_DATE - INTERVAL '7 days') AS agentes_ativos_semana
        FROM vistorias v
        WHERE v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
        GROUP BY v.cliente_id
      ),
      imoveis_stats AS (
        SELECT im.cliente_id, COUNT(*) FILTER (WHERE im.deleted_at IS NULL) AS total_imoveis
        FROM imoveis im
        WHERE im.cliente_id = ${clienteId}::uuid
        GROUP BY im.cliente_id
      ),
      score_stats AS (
        SELECT
          ts.cliente_id,
          ROUND(AVG(ts.score)::numeric, 1) AS score_medio,
          COUNT(*) FILTER (WHERE ts.classificacao = 'critico') AS imoveis_criticos
        FROM territorio_score ts
        WHERE ts.cliente_id = ${clienteId}::uuid
        GROUP BY ts.cliente_id
      ),
      casos_stats AS (
        SELECT cn.cliente_id, COUNT(*) FILTER (WHERE cn.created_at >= CURRENT_DATE - INTERVAL '7 days') AS casos_novos_semana
        FROM casos_notificados cn
        WHERE cn.cliente_id = ${clienteId}::uuid AND cn.deleted_at IS NULL
        GROUP BY cn.cliente_id
      )
      SELECT
        ${clienteId}::uuid AS cliente_id,
        date_trunc('week', CURRENT_DATE)::date AS semana_ref,
        COALESCE(fs.total_focos_ativos, 0) AS total_focos_ativos,
        COALESCE(fs.focos_novos_semana, 0) AS focos_novos_semana,
        COALESCE(fs.focos_resolvidos_semana, 0) AS focos_resolvidos_semana,
        ROUND(COALESCE(fs.focos_resolvidos_semana,0) * 100.0 / NULLIF(COALESCE(fs.focos_novos_semana,0) + COALESCE(fs.focos_resolvidos_semana,0), 0), 1) AS taxa_resolucao_pct,
        COALESCE(ss.slas_vencidos, 0) AS slas_vencidos,
        ROUND((COALESCE(ss.total_slas,0) - COALESCE(ss.slas_vencidos,0)) * 100.0 / NULLIF(COALESCE(ss.total_slas,0), 0), 1) AS sla_conformidade_pct,
        COALESCE(vs.imoveis_visitados_semana, 0) AS imoveis_visitados_semana,
        ROUND(COALESCE(vs.imoveis_visitados_semana,0) * 100.0 / NULLIF(COALESCE(ims.total_imoveis,0), 0), 1) AS cobertura_pct,
        scs.score_medio,
        COALESCE(scs.imoveis_criticos, 0) AS imoveis_criticos,
        COALESCE(cas.casos_novos_semana, 0) AS casos_novos_semana,
        COALESCE(vs.agentes_ativos_semana, 0) AS agentes_ativos_semana
      FROM (SELECT ${clienteId}::uuid AS cliente_id) base
      LEFT JOIN focos_stats fs ON fs.cliente_id = base.cliente_id
      LEFT JOIN sla_stats ss ON ss.cliente_id = base.cliente_id
      LEFT JOIN vistorias_stats vs ON vs.cliente_id = base.cliente_id
      LEFT JOIN imoveis_stats ims ON ims.cliente_id = base.cliente_id
      LEFT JOIN score_stats scs ON scs.cliente_id = base.cliente_id
      LEFT JOIN casos_stats cas ON cas.cliente_id = base.cliente_id
    `) as any[];
    return rows[0] ?? null;
  }
}
