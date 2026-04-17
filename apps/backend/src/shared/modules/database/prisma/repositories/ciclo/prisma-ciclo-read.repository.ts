import { FilterCicloInput } from '@modules/ciclo/dtos/filter-ciclo.input';
import { Ciclo } from '@modules/ciclo/entities/ciclo';
import {
  CicloProgresso,
  CicloReadRepository,
} from '@modules/ciclo/repositories/ciclo-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaCicloMapper } from '../../mappers/prisma-ciclo.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(CicloReadRepository)
@Injectable()
export class PrismaCicloReadRepository implements CicloReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Ciclo | null> {
    const raw = await this.prisma.client.ciclos.findUnique({ where: { id } });
    return raw ? PrismaCicloMapper.toDomain(raw) : null;
  }

  async findAll(filters: FilterCicloInput): Promise<Ciclo[]> {
    const rows = await this.prisma.client.ciclos.findMany({
      where: {
        ...(filters.clienteId && { cliente_id: filters.clienteId }),
        ...(filters.ano && { ano: filters.ano }),
        ...(filters.status && { status: filters.status }),
      },
      orderBy: [{ ano: 'desc' }, { numero: 'desc' }],
    });
    return rows.map((r) => PrismaCicloMapper.toDomain(r));
  }

  async findAtivoByClienteId(clienteId: string): Promise<Ciclo | null> {
    return this.findAtivo(clienteId);
  }

  async findAtivo(clienteId: string): Promise<Ciclo | null> {
    const raw = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
    });
    return raw ? PrismaCicloMapper.toDomain(raw) : null;
  }

  async findByNumeroAno(
    clienteId: string,
    numero: number,
    ano: number,
  ): Promise<Ciclo | null> {
    const raw = await this.prisma.client.ciclos.findUnique({
      where: { cliente_id_numero_ano: { cliente_id: clienteId, numero, ano } },
    });
    return raw ? PrismaCicloMapper.toDomain(raw) : null;
  }

  async findProgresso(clienteId: string): Promise<CicloProgresso | null> {
    type Row = {
      cliente_id: string;
      ciclo: number;
      imoveis_total: bigint;
      imoveis_visitados: bigint;
      imoveis_sem_acesso: bigint;
      cobertura_pct: number;
      vistorias_total: bigint;
      vistorias_liraa: bigint;
      agentes_ativos: bigint;
      focos_total: bigint;
      focos_ativos: bigint;
      focos_resolvidos: bigint;
      alertas_retorno_pendentes: bigint;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      WITH ciclo_ativo AS (
        SELECT numero
        FROM   ciclos
        WHERE  cliente_id = ${clienteId}::uuid
          AND  status = 'ativo'
        LIMIT 1
      ),
      imoveis_count AS (
        SELECT COUNT(*) AS total
        FROM   imoveis
        WHERE  cliente_id = ${clienteId}::uuid
          AND  deleted_at IS NULL
      ),
      vistorias_stats AS (
        SELECT
          COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.acesso_realizado = true)  AS visitados,
          COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.acesso_realizado = false) AS sem_acesso,
          COUNT(v.id)                                                             AS total_vistorias,
          0::bigint                                                               AS vistorias_liraa,
          COUNT(DISTINCT v.agente_id)                                            AS agentes_ativos
        FROM   vistorias v
        WHERE  v.cliente_id = ${clienteId}::uuid
          AND  v.deleted_at IS NULL
          AND  v.ciclo = (SELECT numero FROM ciclo_ativo)
      ),
      focos_stats AS (
        SELECT
          COUNT(*)                                                              AS focos_total,
          COUNT(*) FILTER (WHERE f.status NOT IN ('resolvido', 'descartado')) AS focos_ativos,
          COUNT(*) FILTER (WHERE f.status = 'resolvido')                      AS focos_resolvidos
        FROM focos_risco f
        WHERE f.cliente_id = ${clienteId}::uuid
      ),
      alertas_stats AS (
        SELECT COALESCE(COUNT(*), 0) AS alertas_pendentes
        FROM   alerta_retorno_imovel a
        WHERE  a.cliente_id = ${clienteId}::uuid
          AND  a.resolvido = false
      )
      SELECT
        ${clienteId}::uuid::text                              AS cliente_id,
        COALESCE((SELECT numero FROM ciclo_ativo), 0)::int   AS ciclo,
        COALESCE(ic.total, 0)                                 AS imoveis_total,
        COALESCE(vs.visitados, 0)                             AS imoveis_visitados,
        COALESCE(vs.sem_acesso, 0)                            AS imoveis_sem_acesso,
        CASE WHEN COALESCE(ic.total, 0) > 0
          THEN ROUND(COALESCE(vs.visitados, 0)::numeric / ic.total * 100, 1)
          ELSE 0
        END::float8                                           AS cobertura_pct,
        COALESCE(vs.total_vistorias, 0)                       AS vistorias_total,
        COALESCE(vs.vistorias_liraa, 0)                       AS vistorias_liraa,
        COALESCE(vs.agentes_ativos, 0)                        AS agentes_ativos,
        COALESCE(fs.focos_total, 0)                           AS focos_total,
        COALESCE(fs.focos_ativos, 0)                          AS focos_ativos,
        COALESCE(fs.focos_resolvidos, 0)                      AS focos_resolvidos,
        COALESCE(al.alertas_pendentes, 0)                     AS alertas_retorno_pendentes
      FROM imoveis_count ic, vistorias_stats vs, focos_stats fs, alertas_stats al
    `;

    if (!rows.length) return null;
    const r = rows[0];
    return {
      clienteId: r.cliente_id,
      ciclo: r.ciclo,
      imoveisTotal: Number(r.imoveis_total),
      imoveisVisitados: Number(r.imoveis_visitados),
      imoveisSemAcesso: Number(r.imoveis_sem_acesso),
      coberturaPct: Number(r.cobertura_pct),
      vistoriasTotal: Number(r.vistorias_total),
      vistoriasLiraa: Number(r.vistorias_liraa),
      agentesAtivos: Number(r.agentes_ativos),
      focosTotal: Number(r.focos_total),
      focosAtivos: Number(r.focos_ativos),
      focosResolvidos: Number(r.focos_resolvidos),
      alertasRetornoPendentes: Number(r.alertas_retorno_pendentes),
    };
  }
}
