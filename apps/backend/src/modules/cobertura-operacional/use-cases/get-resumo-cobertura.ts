import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  ResumoCoberturaDto,
  calcularPercentual,
} from '../view-model/cobertura.vm';

type RawQStats = { total: number; cobertos: number; parcial: number; sem_cobertura: number };
type RawAgentes = { total: number; com_cobertura: number };
type RawCount = { total: number };

@Injectable()
export class GetResumoCoberturaUc {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<ResumoCoberturaDto> {
    const cicloAtivo = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      select: { id: true, numero: true, ano: true },
    });

    const totalImoveis = await this.prisma.client.imoveis.count({
      where: { cliente_id: clienteId, deleted_at: null },
    });

    if (!cicloAtivo) {
      return {
        ciclo: null,
        municipio: { totalImoveis, totalVisitados: 0, totalPendentes: totalImoveis, percentualCobertura: 0 },
        quarteiroes: { total: 0, cobertos: 0, parcialmenteCobertos: 0, semCobertura: 0 },
        agentes: { total: 0, comCobertura: 0, semCobertura: 0 },
        indicadores: { imoveisNuncaVisitados: 0, quarteiroesNuncaVisitados: 0 },
      };
    }

    const cicloNum = cicloAtivo.numero;

    const [visitadosRows, qStatsRows, agentesRows, nuncaRows, qNuncaRows] = await Promise.all([
      this.prisma.client.$queryRaw<RawCount[]>(Prisma.sql`
        SELECT COUNT(DISTINCT imovel_id)::int AS total
        FROM vistorias
        WHERE cliente_id = ${clienteId}::uuid
          AND ciclo = ${cicloNum}
          AND deleted_at IS NULL
          AND imovel_id IS NOT NULL
      `),

      this.prisma.client.$queryRaw<RawQStats[]>(Prisma.sql`
        WITH q_stats AS (
          SELECT
            dq.quadra_id,
            COUNT(DISTINCT i.id)::float AS total_imoveis,
            COUNT(DISTINCT v.imovel_id)::float AS visitados
          FROM bairros_distribuicao dq
          JOIN bairros_quadras q ON q.id = dq.quadra_id
          LEFT JOIN imoveis i
            ON (i.quadra_id = q.id OR (i.quadra_id IS NULL AND i.quarteirao = q.codigo))
            AND i.cliente_id = dq.cliente_id AND i.deleted_at IS NULL
          LEFT JOIN vistorias v
            ON v.imovel_id = i.id AND v.ciclo = ${cicloNum} AND v.deleted_at IS NULL AND v.imovel_id IS NOT NULL
          WHERE dq.cliente_id = ${clienteId}::uuid AND dq.ciclo_id = ${cicloAtivo.id}::uuid
          GROUP BY dq.quadra_id
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE visitados = 0)::int AS sem_cobertura,
          COUNT(*) FILTER (
            WHERE visitados > 0
              AND (CASE WHEN total_imoveis = 0 THEN 0 ELSE visitados / total_imoveis * 100 END) < 80
          )::int AS parcial,
          COUNT(*) FILTER (
            WHERE visitados > 0
              AND (CASE WHEN total_imoveis = 0 THEN 0 ELSE visitados / total_imoveis * 100 END) >= 80
          )::int AS cobertos
        FROM q_stats
      `),

      this.prisma.client.$queryRaw<RawAgentes[]>(Prisma.sql`
        SELECT
          COUNT(DISTINCT dq.agente_id)::int AS total,
          COUNT(DISTINCT v.agente_id)::int AS com_cobertura
        FROM bairros_distribuicao dq
        LEFT JOIN vistorias v
          ON v.agente_id = dq.agente_id
          AND v.cliente_id = dq.cliente_id
          AND v.ciclo = ${cicloNum}
          AND v.deleted_at IS NULL
        WHERE dq.cliente_id = ${clienteId}::uuid AND dq.ciclo_id = ${cicloAtivo.id}::uuid
      `),

      this.prisma.client.$queryRaw<RawCount[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM imoveis i
        WHERE i.cliente_id = ${clienteId}::uuid
          AND i.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM vistorias v WHERE v.imovel_id = i.id AND v.deleted_at IS NULL
          )
      `),

      this.prisma.client.$queryRaw<RawCount[]>(Prisma.sql`
        SELECT COUNT(DISTINCT dq.quadra_id)::int AS total
        FROM bairros_distribuicao dq
        JOIN bairros_quadras q ON q.id = dq.quadra_id
        WHERE dq.cliente_id = ${clienteId}::uuid AND dq.ciclo_id = ${cicloAtivo.id}::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM vistorias v
            INNER JOIN imoveis i ON i.id = v.imovel_id
            WHERE (i.quadra_id = q.id OR (i.quadra_id IS NULL AND i.quarteirao = q.codigo))
              AND i.cliente_id = ${clienteId}::uuid
              AND v.cliente_id = ${clienteId}::uuid
              AND v.deleted_at IS NULL
              AND i.deleted_at IS NULL
          )
      `),
    ]);

    const totalVisitados = Number(visitadosRows[0]?.total ?? 0);
    const qStats = qStatsRows[0] ?? { total: 0, cobertos: 0, parcial: 0, sem_cobertura: 0 };
    const agentesStats = agentesRows[0] ?? { total: 0, com_cobertura: 0 };
    const nuncaVisitados = Number(nuncaRows[0]?.total ?? 0);
    const qNunca = Number(qNuncaRows[0]?.total ?? 0);

    return {
      ciclo: {
        id: cicloAtivo.id,
        numero: cicloAtivo.numero,
        nome: `Ciclo ${cicloAtivo.numero}/${cicloAtivo.ano}`,
      },
      municipio: {
        totalImoveis,
        totalVisitados,
        totalPendentes: Math.max(0, totalImoveis - totalVisitados),
        percentualCobertura: calcularPercentual(totalVisitados, totalImoveis),
      },
      quarteiroes: {
        total: Number(qStats.total),
        cobertos: Number(qStats.cobertos),
        parcialmenteCobertos: Number(qStats.parcial),
        semCobertura: Number(qStats.sem_cobertura),
      },
      agentes: {
        total: Number(agentesStats.total),
        comCobertura: Number(agentesStats.com_cobertura),
        semCobertura: Math.max(0, Number(agentesStats.total) - Number(agentesStats.com_cobertura)),
      },
      indicadores: {
        imoveisNuncaVisitados: nuncaVisitados,
        quarteiroesNuncaVisitados: qNunca,
      },
    };
  }
}
