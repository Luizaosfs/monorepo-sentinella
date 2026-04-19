import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetReincidenciaPorDeposito {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH depositos_com_foco AS (
        SELECT
          v.cliente_id,
          im.bairro,
          im.regiao_id,
          vd.tipo AS tipo_deposito,
          COUNT(DISTINCT v.imovel_id) AS imoveis_afetados,
          SUM(vd.qtd_com_focos) AS total_focos_deposito,
          SUM(vd.qtd_eliminados) AS total_eliminados,
          COUNT(DISTINCT v.imovel_id) FILTER (WHERE EXISTS (
            SELECT 1 FROM focos_risco fr2
            WHERE fr2.imovel_id = v.imovel_id AND fr2.foco_anterior_id IS NOT NULL
              AND fr2.cliente_id = ${clienteId}::uuid AND fr2.deleted_at IS NULL
          )) AS imoveis_multiciclo,
          ROUND(AVG(CASE WHEN vd.usou_larvicida THEN 100.0 ELSE 0 END), 1) AS uso_larvicida_pct,
          ROUND(SUM(vd.qtd_eliminados)::numeric / NULLIF(SUM(vd.qtd_com_focos), 0) * 100, 1) AS taxa_eliminacao_pct
        FROM vistorias v
        JOIN imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
        JOIN vistoria_depositos vd ON vd.vistoria_id = v.id AND vd.qtd_com_focos > 0
        WHERE v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
        GROUP BY v.cliente_id, im.bairro, im.regiao_id, vd.tipo
      )
      SELECT
        *,
        ROUND(imoveis_multiciclo::numeric / NULLIF(imoveis_afetados, 0) * 100, 1) AS indice_reincidencia_pct
      FROM depositos_com_foco
      ORDER BY imoveis_multiciclo DESC, total_focos_deposito DESC
    `)
  }
}
