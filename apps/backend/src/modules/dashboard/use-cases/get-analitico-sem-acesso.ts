import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

export interface AnaliticoSemAcessoResult {
  focos_aguardando: number
  aguardando_decisao_supervisor: number
  tentativa_1: number
  tentativa_2: number
  tentativa_3_mais: number
  novos_7d: number
  novos_30d: number
}

@Injectable()
export class GetAnaliticoSemAcesso {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<AnaliticoSemAcessoResult | null> {
    const rows = await this.prisma.client.$queryRaw<AnaliticoSemAcessoResult[]>(Prisma.sql`
      WITH snapshot AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'aguardando_nova_tentativa')::int                                         AS focos_aguardando,
          COUNT(*) FILTER (WHERE status = 'aguardando_nova_tentativa' AND pendente_decisao_supervisor = true)::int  AS aguardando_decisao_supervisor,
          COUNT(*) FILTER (WHERE status = 'aguardando_nova_tentativa' AND tentativas_sem_acesso = 1)::int           AS tentativa_1,
          COUNT(*) FILTER (WHERE status = 'aguardando_nova_tentativa' AND tentativas_sem_acesso = 2)::int           AS tentativa_2,
          COUNT(*) FILTER (WHERE status = 'aguardando_nova_tentativa' AND tentativas_sem_acesso >= 3)::int          AS tentativa_3_mais
        FROM focos_risco
        WHERE cliente_id = ${clienteId}::uuid AND deleted_at IS NULL
      ),
      tendencia AS (
        SELECT
          COUNT(DISTINCT foco_risco_id) FILTER (WHERE alterado_em >= NOW() - INTERVAL '7 days')::int  AS novos_7d,
          COUNT(DISTINCT foco_risco_id) FILTER (WHERE alterado_em >= NOW() - INTERVAL '30 days')::int AS novos_30d
        FROM foco_risco_historico
        WHERE cliente_id = ${clienteId}::uuid
          AND tipo_evento IN ('sem_acesso_registrado', 'escalado_supervisor')
      )
      SELECT
        s.focos_aguardando,
        s.aguardando_decisao_supervisor,
        s.tentativa_1,
        s.tentativa_2,
        s.tentativa_3_mais,
        t.novos_7d,
        t.novos_30d
      FROM snapshot s, tendencia t
    `)
    return rows[0] ?? null
  }
}
