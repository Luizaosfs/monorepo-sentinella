import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RelatorioGerado,
  ResumoDiario,
  SystemAlert,
  SystemHealthLog,
} from 'src/modules/dashboard/entities/dashboard';
import {
  AgenteStat,
  CentralKpis,
  CicloDisponivel,
  ConsumoLarvicidaRow,
  DashboardReadRepository,
  ImovelParaHoje,
  LiraaQuarteiraoRow,
  LiraaResult,
  ResumoAgenteResult,
  ResumoRegionalRow,
  ScoreSurtoRow,
} from 'src/modules/dashboard/repositories/dashboard-read.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaDashboardMapper } from '../../mappers/prisma-dashboard.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(DashboardReadRepository)
@Injectable()
export class PrismaDashboardReadRepository implements DashboardReadRepository {
  constructor(private prisma: PrismaService) {}

  async findResumos(clienteId: string, limit = 30): Promise<ResumoDiario[]> {
    const rows = await this.prisma.client.resumos_diarios.findMany({
      where: { cliente_id: clienteId },
      orderBy: { data_ref: 'desc' },
      take: limit,
    });
    return rows.map(PrismaDashboardMapper.resumoToDomain);
  }

  async findRelatorios(clienteId: string): Promise<RelatorioGerado[]> {
    const rows = await this.prisma.client.relatorios_gerados.findMany({
      where: { cliente_id: clienteId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(PrismaDashboardMapper.relatorioToDomain);
  }

  async findHealthLogs(limit = 50): Promise<SystemHealthLog[]> {
    const rows = await this.prisma.client.system_health_log.findMany({
      orderBy: { criado_em: 'desc' },
      take: limit,
    });
    return rows.map(PrismaDashboardMapper.healthToDomain);
  }

  async findAlerts(resolvido?: boolean): Promise<SystemAlert[]> {
    const rows = await this.prisma.client.system_alerts.findMany({
      where: resolvido !== undefined ? { resolvido } : {},
      orderBy: { criado_em: 'desc' },
    });
    return rows.map(PrismaDashboardMapper.alertToDomain);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async calcularLiraa(clienteId: string, ciclo?: number): Promise<LiraaResult> {
    const cicloFilter = ciclo
      ? Prisma.sql`AND v.ciclo = ${ciclo}`
      : Prisma.sql``;

    type Row = {
      total_inspecionados: bigint;
      com_acesso: bigint;
      total_positivos: bigint;
      total_depositos: bigint;
      depositos_positivos: bigint;
    };

    const [row] = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        COUNT(DISTINCT v.id)                                             AS total_inspecionados,
        COUNT(DISTINCT v.id) FILTER (WHERE v.acesso_realizado = true)   AS com_acesso,
        COUNT(DISTINCT vd_pos.vistoria_id)                              AS total_positivos,
        COUNT(vd.id)                                                     AS total_depositos,
        COUNT(vd.id) FILTER (WHERE vd.com_larva = true)                 AS depositos_positivos
      FROM vistorias v
      LEFT JOIN vistoria_depositos vd     ON vd.vistoria_id = v.id
      LEFT JOIN (
        SELECT DISTINCT vistoria_id
        FROM vistoria_depositos
        WHERE com_larva = true
      ) vd_pos ON vd_pos.vistoria_id = v.id
      WHERE v.cliente_id = ${clienteId}::uuid
        AND v.acesso_realizado = true
        AND v.deleted_at IS NULL
        ${cicloFilter}
    `;

    const total = Number(row?.total_inspecionados ?? 0);
    const positivos = Number(row?.total_positivos ?? 0);
    const depPos = Number(row?.depositos_positivos ?? 0);

    return {
      clienteId,
      ciclo: ciclo ?? null,
      totalInspecionados: total,
      comAcesso: Number(row?.com_acesso ?? 0),
      totalPositivos: positivos,
      totalDepositos: Number(row?.total_depositos ?? 0),
      depositosPositivos: depPos,
      iip: total > 0 ? Math.round((positivos / total) * 10000) / 100 : 0,
      ibp: total > 0 ? Math.round((depPos / total) * 10000) / 100 : 0,
    };
  }

  async comparativoAgentes(
    clienteId: string,
    ciclo?: number,
  ): Promise<AgenteStat[]> {
    const cicloFilter = ciclo
      ? Prisma.sql`AND v.ciclo = ${ciclo}`
      : Prisma.sql``;

    type Row = {
      agente_id: string;
      nome: string;
      total_visitas: bigint;
      com_acesso: bigint;
      sem_acesso: bigint;
      total_depositos: bigint;
      depositos_com_larva: bigint;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        v.agente_id,
        u.nome,
        COUNT(DISTINCT v.id)                                              AS total_visitas,
        COUNT(DISTINCT v.id) FILTER (WHERE v.acesso_realizado = true)    AS com_acesso,
        COUNT(DISTINCT v.id) FILTER (WHERE v.acesso_realizado = false)   AS sem_acesso,
        COUNT(vd.id)                                                      AS total_depositos,
        COUNT(vd.id) FILTER (WHERE vd.com_larva = true)                  AS depositos_com_larva
      FROM vistorias v
      JOIN usuarios u ON u.id = v.agente_id
      LEFT JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
      WHERE v.cliente_id = ${clienteId}::uuid
        AND v.deleted_at IS NULL
        ${cicloFilter}
      GROUP BY v.agente_id, u.nome
      ORDER BY total_visitas DESC
    `;

    return rows.map((r) => {
      const total = Number(r.total_visitas);
      const com = Number(r.com_acesso);
      return {
        agenteId: r.agente_id,
        nome: r.nome,
        totalVisitas: total,
        comAcesso: com,
        semAcesso: Number(r.sem_acesso),
        taxaAcesso: total > 0 ? Math.round((com / total) * 10000) / 100 : 0,
        totalDepositos: Number(r.total_depositos),
        depositosComLarva: Number(r.depositos_com_larva),
      };
    });
  }

  async consumoLarvicida(
    clienteId: string,
    ciclo?: number,
  ): Promise<ConsumoLarvicidaRow[]> {
    const cicloFilter = ciclo
      ? Prisma.sql`AND v.ciclo = ${ciclo}`
      : Prisma.sql``;

    type Row = {
      agente_id: string;
      nome: string;
      tipo_deposito: string;
      depositos_tratados: bigint;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        v.agente_id,
        u.nome,
        vd.tipo_deposito,
        COUNT(vd.id) FILTER (WHERE vd.tratado = true) AS depositos_tratados
      FROM vistorias v
      JOIN usuarios u ON u.id = v.agente_id
      JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
      WHERE v.cliente_id = ${clienteId}::uuid
        AND v.deleted_at IS NULL
        ${cicloFilter}
      GROUP BY v.agente_id, u.nome, vd.tipo_deposito
      ORDER BY v.agente_id, depositos_tratados DESC
    `;

    // Agrupa por agente, agregando porTipo
    const byAgente = new Map<string, ConsumoLarvicidaRow>();
    for (const r of rows) {
      const key = r.agente_id;
      if (!byAgente.has(key)) {
        byAgente.set(key, {
          agenteId: r.agente_id,
          nome: r.nome,
          depositosTratados: 0,
          totalLarvicidaG: null,
          porTipo: [],
        });
      }
      const entry = byAgente.get(key)!;
      const qtd = Number(r.depositos_tratados);
      entry.depositosTratados += qtd;
      entry.porTipo.push({ tipoDeposito: r.tipo_deposito, qtd });
    }

    return Array.from(byAgente.values());
  }

  async resumoRegional(
    clienteId: string,
    ciclo?: number,
    de?: Date,
    ate?: Date,
  ): Promise<ResumoRegionalRow[]> {
    const cicloFilter = ciclo
      ? Prisma.sql`AND v.ciclo = ${ciclo}`
      : Prisma.sql``;
    const deFilter = de ? Prisma.sql`AND v.data_visita >= ${de}` : Prisma.sql``;
    const ateFilter = ate
      ? Prisma.sql`AND v.data_visita <= ${ate}`
      : Prisma.sql``;

    type Row = {
      regiao_id: string;
      regiao_nome: string;
      total_vistorias: bigint;
      vistorias_com_acesso: bigint;
      total_depositos: bigint;
      depositos_positivos: bigint;
      focos_ativos: bigint;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        r.id                                                                         AS regiao_id,
        r.nome                                                                       AS regiao_nome,
        COUNT(DISTINCT v.id)                                                         AS total_vistorias,
        COUNT(DISTINCT v.id) FILTER (WHERE v.acesso_realizado = true)               AS vistorias_com_acesso,
        COUNT(vd.id)                                                                 AS total_depositos,
        COUNT(vd.id) FILTER (WHERE vd.com_larva = true)                             AS depositos_positivos,
        COUNT(DISTINCT fr.id)                                                        AS focos_ativos
      FROM regioes r
      LEFT JOIN imoveis im   ON im.regiao_id = r.id AND im.deleted_at IS NULL
      LEFT JOIN vistorias v  ON v.imovel_id = im.id AND v.deleted_at IS NULL
        ${cicloFilter} ${deFilter} ${ateFilter}
      LEFT JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
      LEFT JOIN focos_risco fr ON fr.regiao_id = r.id
        AND fr.status IN ('confirmado', 'em_tratamento')
        AND fr.deleted_at IS NULL
      WHERE r.cliente_id = ${clienteId}::uuid
      GROUP BY r.id, r.nome
      ORDER BY total_vistorias DESC
    `;

    return rows.map((r) => ({
      regiaoId: r.regiao_id,
      regiaoNome: r.regiao_nome,
      totalVistorias: Number(r.total_vistorias),
      vistoriasComAcesso: Number(r.vistorias_com_acesso),
      totalDepositos: Number(r.total_depositos),
      depositosPositivos: Number(r.depositos_positivos),
      focosAtivos: Number(r.focos_ativos),
    }));
  }

  async scoreSurtoRegioes(clienteId: string): Promise<ScoreSurtoRow[]> {
    type Row = {
      regiao_id: string;
      regiao_nome: string;
      chuva_7d: number | null;
      dias_pos_chuva: number | null;
      focos_ativos: bigint;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        r.id                                                      AS regiao_id,
        r.nome                                                    AS regiao_nome,
        COALESCE(pr.chuva_7d, 0)                                 AS chuva_7d,
        COALESCE(pr.dias_pos_chuva, 0)                           AS dias_pos_chuva,
        COUNT(DISTINCT fr.id)                                     AS focos_ativos
      FROM regioes r
      LEFT JOIN pluvio_risco pr ON pr.regiao_id = r.id
      LEFT JOIN focos_risco fr  ON fr.regiao_id = r.id
        AND fr.status IN ('confirmado', 'em_tratamento', 'suspeita')
        AND fr.deleted_at IS NULL
      WHERE r.cliente_id = ${clienteId}::uuid
      GROUP BY r.id, r.nome, pr.chuva_7d, pr.dias_pos_chuva
      ORDER BY focos_ativos DESC, chuva_7d DESC
    `;

    return rows.map((r) => {
      const focos = Number(r.focos_ativos);
      const chuva = Number(r.chuva_7d ?? 0);
      const dias = Number(r.dias_pos_chuva ?? 0);
      // Score 0–100: pesos chuva(30) + dias pós-chuva(20) + focos(50)
      const scoreChuva = Math.min(chuva / 50, 1) * 30;
      const scoreDias = Math.min(dias / 7, 1) * 20;
      const scoreFocos = Math.min(focos / 20, 1) * 50;
      return {
        regiaoId: r.regiao_id,
        regiaoNome: r.regiao_nome,
        chuva7d: chuva,
        diasPosChuva: dias,
        focosAtivos: focos,
        scoreSurto: Math.round(scoreChuva + scoreDias + scoreFocos),
      };
    });
  }

  async resumoAgente(
    clienteId: string,
    agenteId: string,
    ciclo?: number,
  ): Promise<ResumoAgenteResult> {
    const cicloFilter = ciclo
      ? Prisma.sql`AND v.ciclo = ${ciclo}`
      : Prisma.sql``;

    type Row = {
      agente_id: string;
      nome: string;
      total_visitas: bigint;
      com_acesso: bigint;
      sem_acesso: bigint;
      total_depositos: bigint;
      depositos_positivos: bigint;
      depositos_tratados: bigint;
    };

    const [row] = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        v.agente_id,
        u.nome,
        COUNT(DISTINCT v.id)                                              AS total_visitas,
        COUNT(DISTINCT v.id) FILTER (WHERE v.acesso_realizado = true)    AS com_acesso,
        COUNT(DISTINCT v.id) FILTER (WHERE v.acesso_realizado = false)   AS sem_acesso,
        COUNT(vd.id)                                                      AS total_depositos,
        COUNT(vd.id) FILTER (WHERE vd.com_larva = true)                  AS depositos_positivos,
        COUNT(vd.id) FILTER (WHERE vd.tratado = true)                    AS depositos_tratados
      FROM vistorias v
      JOIN usuarios u ON u.id = v.agente_id
      LEFT JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
      WHERE v.cliente_id = ${clienteId}::uuid
        AND v.agente_id   = ${agenteId}::uuid
        AND v.deleted_at IS NULL
        ${cicloFilter}
      GROUP BY v.agente_id, u.nome
    `;

    if (!row) {
      return {
        agenteId,
        nome: '',
        ciclo: ciclo ?? null,
        totalVisitas: 0,
        comAcesso: 0,
        semAcesso: 0,
        taxaAcesso: 0,
        totalDepositos: 0,
        depositosPositivos: 0,
        depositosTratados: 0,
      };
    }

    const total = Number(row.total_visitas);
    const com = Number(row.com_acesso);
    return {
      agenteId: row.agente_id,
      nome: row.nome,
      ciclo: ciclo ?? null,
      totalVisitas: total,
      comAcesso: com,
      semAcesso: Number(row.sem_acesso),
      taxaAcesso: total > 0 ? Math.round((com / total) * 10000) / 100 : 0,
      totalDepositos: Number(row.total_depositos),
      depositosPositivos: Number(row.depositos_positivos),
      depositosTratados: Number(row.depositos_tratados),
    };
  }

  async getCentralKpis(clienteId: string): Promise<CentralKpis> {
    type Row = {
      focos_pendentes: bigint;
      focos_em_atendimento: bigint;
      focos_p1_sem_agente: bigint;
      slas_vencidos: bigint;
      slas_vencendo_2h: bigint;
      imoveis_criticos: bigint;
      imoveis_muito_alto: bigint;
      score_medio_municipio: number | null;
      vistorias_hoje: bigint;
      agentes_ativos_hoje: bigint;
      denuncias_ultimas_24h: bigint;
      casos_hoje: bigint;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        (SELECT COUNT(*) FROM focos_risco
         WHERE cliente_id = ${clienteId}::uuid
           AND status NOT IN ('resolvido', 'descartado'))                           AS focos_pendentes,

        (SELECT COUNT(*) FROM focos_risco
         WHERE cliente_id = ${clienteId}::uuid
           AND status = 'em_tratamento')                                            AS focos_em_atendimento,

        (SELECT COUNT(*) FROM focos_risco
         WHERE cliente_id = ${clienteId}::uuid
           AND prioridade = 'P1'
           AND responsavel_id IS NULL
           AND status NOT IN ('resolvido', 'descartado'))                           AS focos_p1_sem_agente,

        (SELECT COUNT(*) FROM sla_operacional
         WHERE cliente_id = ${clienteId}::uuid
           AND status IN ('pendente', 'em_atendimento')
           AND deleted_at IS NULL
           AND prazo_final < NOW())                                                  AS slas_vencidos,

        (SELECT COUNT(*) FROM sla_operacional
         WHERE cliente_id = ${clienteId}::uuid
           AND status IN ('pendente', 'em_atendimento')
           AND deleted_at IS NULL
           AND prazo_final BETWEEN NOW() AND NOW() + INTERVAL '2 hours')            AS slas_vencendo_2h,

        (SELECT COUNT(*) FROM territorio_score
         WHERE cliente_id = ${clienteId}::uuid
           AND classificacao = 'critico')                                           AS imoveis_criticos,

        (SELECT COUNT(*) FROM territorio_score
         WHERE cliente_id = ${clienteId}::uuid
           AND classificacao = 'alto')                                              AS imoveis_muito_alto,

        (SELECT AVG(score)::float8 FROM territorio_score
         WHERE cliente_id = ${clienteId}::uuid)                                    AS score_medio_municipio,

        (SELECT COUNT(*) FROM vistorias
         WHERE cliente_id = ${clienteId}::uuid
           AND deleted_at IS NULL
           AND created_at >= CURRENT_DATE)                                          AS vistorias_hoje,

        (SELECT COUNT(DISTINCT agente_id) FROM vistorias
         WHERE cliente_id = ${clienteId}::uuid
           AND deleted_at IS NULL
           AND created_at >= CURRENT_DATE)                                          AS agentes_ativos_hoje,

        (SELECT COUNT(*) FROM focos_risco
         WHERE cliente_id = ${clienteId}::uuid
           AND origem_tipo = 'denuncia'
           AND created_at >= NOW() - INTERVAL '24 hours')                           AS denuncias_ultimas_24h,

        (SELECT COUNT(*) FROM casos_notificados
         WHERE cliente_id = ${clienteId}::uuid
           AND created_at >= CURRENT_DATE)                                          AS casos_hoje
    `;

    const r = rows[0];
    return {
      clienteId,
      dataRef: new Date().toISOString().slice(0, 10),
      focosPendentes: Number(r.focos_pendentes),
      focosEmAtendimento: Number(r.focos_em_atendimento),
      focosP1SemAgente: Number(r.focos_p1_sem_agente),
      slasVencidos: Number(r.slas_vencidos),
      slasVencendo2h: Number(r.slas_vencendo_2h),
      imoveisCriticos: Number(r.imoveis_criticos),
      imoveisMuitoAlto: Number(r.imoveis_muito_alto),
      scoreMedioMunicipio:
        r.score_medio_municipio != null ? Number(r.score_medio_municipio) : null,
      vistoriasHoje: Number(r.vistorias_hoje),
      agentesAtivosHoje: Number(r.agentes_ativos_hoje),
      denunciasUltimas24h: Number(r.denuncias_ultimas_24h),
      casosHoje: Number(r.casos_hoje),
    };
  }

  async listImoveisParaHoje(
    clienteId: string,
    limit: number,
  ): Promise<ImovelParaHoje[]> {
    type Row = {
      cliente_id: string;
      imovel_id: string;
      score: number;
      classificacao: string;
      fatores: unknown;
      calculado_em: Date;
      logradouro: string | null;
      numero: string | null;
      bairro: string | null;
      quarteirao: string | null;
      latitude: number | null;
      longitude: number | null;
      historico_recusa: boolean;
      prioridade_drone: boolean;
      sla_mais_urgente: string | null;
      prioridade_foco_ativo: string | null;
      focos_ativos_count: bigint;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        ts.cliente_id,
        ts.imovel_id,
        ts.score::float8,
        ts.classificacao,
        ts.fatores,
        ts.calculado_em,
        im.logradouro,
        im.numero,
        im.bairro,
        im.quarteirao,
        im.latitude,
        im.longitude,
        im.historico_recusa,
        im.prioridade_drone,
        (SELECT s.prioridade
         FROM sla_operacional s
         JOIN focos_risco f ON f.id = s.foco_risco_id
         WHERE f.imovel_id = im.id
           AND s.status IN ('pendente', 'em_atendimento')
           AND s.deleted_at IS NULL
         ORDER BY s.prazo_final ASC
         LIMIT 1)                                           AS sla_mais_urgente,
        (SELECT f.prioridade
         FROM focos_risco f
         WHERE f.imovel_id = im.id
           AND f.status NOT IN ('resolvido', 'descartado')
         ORDER BY f.score_prioridade DESC
         LIMIT 1)                                           AS prioridade_foco_ativo,
        (SELECT COUNT(*)
         FROM focos_risco f
         WHERE f.imovel_id = im.id
           AND f.status NOT IN ('resolvido', 'descartado')) AS focos_ativos_count
      FROM territorio_score ts
      JOIN imoveis im ON im.id = ts.imovel_id
      WHERE ts.cliente_id = ${clienteId}::uuid
        AND im.deleted_at IS NULL
      ORDER BY ts.score DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      clienteId: r.cliente_id,
      imovelId: r.imovel_id,
      score: Number(r.score),
      classificacao: r.classificacao,
      fatores: (r.fatores ?? {}) as Record<string, unknown>,
      calculadoEm: r.calculado_em.toISOString(),
      logradouro: r.logradouro,
      numero: r.numero,
      bairro: r.bairro,
      quarteirao: r.quarteirao,
      latitude: r.latitude,
      longitude: r.longitude,
      historicoRecusa: r.historico_recusa,
      prioridadeDrone: r.prioridade_drone,
      slaMaisUrgente: r.sla_mais_urgente,
      prioridadeFocoAtivo: r.prioridade_foco_ativo,
      focosAtivosCount: Number(r.focos_ativos_count),
    }));
  }

  async listCiclosDisponiveis(clienteId: string): Promise<CicloDisponivel[]> {
    const rows = await this.prisma.client.ciclos.findMany({
      where: { cliente_id: clienteId },
      select: {
        id: true,
        numero: true,
        ano: true,
        status: true,
        data_inicio: true,
        data_fim_prevista: true,
      },
      orderBy: [{ ano: 'desc' }, { numero: 'desc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      ano: r.ano,
      status: r.status,
      dataInicio: r.data_inicio ?? null,
      dataFimPrevista: r.data_fim_prevista ?? null,
    }));
  }

  async listLiraaByQuarteirao(
    clienteId: string,
    ciclo?: number,
  ): Promise<LiraaQuarteiraoRow[]> {
    const cicloFilter =
      ciclo !== undefined ? Prisma.sql`AND v.ciclo = ${ciclo}` : Prisma.sql``;

    type Row = {
      ciclo: number;
      bairro: string | null;
      quarteirao: string | null;
      imoveis_inspecionados: bigint;
      imoveis_positivos: bigint;
      depositos_positivos: bigint;
      total_focos: bigint;
      focos_a1: bigint;
      focos_a2: bigint;
      focos_b: bigint;
      focos_c: bigint;
      focos_d1: bigint;
      focos_d2: bigint;
      focos_e: bigint;
      larvicida_total_g: number | null;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        v.ciclo,
        i.bairro,
        i.quarteirao,
        COUNT(DISTINCT v.id) FILTER (WHERE v.acesso_realizado = true)
          AS imoveis_inspecionados,
        COUNT(DISTINCT v.id) FILTER (
          WHERE v.acesso_realizado = true
            AND EXISTS (
              SELECT 1 FROM vistoria_depositos vd2
              WHERE vd2.vistoria_id = v.id
                AND vd2.qtd_com_focos > 0
                AND vd2.deleted_at IS NULL
            )
        ) AS imoveis_positivos,
        COUNT(vd.id) FILTER (WHERE vd.qtd_com_focos > 0 AND vd.deleted_at IS NULL)
          AS depositos_positivos,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.deleted_at IS NULL), 0)
          AS total_focos,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.tipo = 'A1' AND vd.deleted_at IS NULL), 0) AS focos_a1,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.tipo = 'A2' AND vd.deleted_at IS NULL), 0) AS focos_a2,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.tipo = 'B'  AND vd.deleted_at IS NULL), 0) AS focos_b,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.tipo = 'C'  AND vd.deleted_at IS NULL), 0) AS focos_c,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.tipo = 'D1' AND vd.deleted_at IS NULL), 0) AS focos_d1,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.tipo = 'D2' AND vd.deleted_at IS NULL), 0) AS focos_d2,
        COALESCE(SUM(vd.qtd_com_focos) FILTER (WHERE vd.tipo = 'E'  AND vd.deleted_at IS NULL), 0) AS focos_e,
        COALESCE(SUM(vd.qtd_larvicida_g) FILTER (WHERE vd.deleted_at IS NULL), 0)
          AS larvicida_total_g
      FROM vistorias v
      JOIN imoveis i ON i.id = v.imovel_id
      LEFT JOIN vistoria_depositos vd ON vd.vistoria_id = v.id
      WHERE v.cliente_id = ${clienteId}::uuid
        AND v.deleted_at IS NULL
        AND i.quarteirao IS NOT NULL
        ${cicloFilter}
      GROUP BY v.ciclo, i.bairro, i.quarteirao
      ORDER BY i.bairro ASC NULLS LAST, i.quarteirao ASC
    `;

    return rows.map((r) => {
      const inspecionados = Number(r.imoveis_inspecionados);
      const positivos = Number(r.imoveis_positivos);
      const depositosPositivos = Number(r.depositos_positivos);
      return {
        cliente_id: clienteId,
        ciclo: r.ciclo,
        bairro: r.bairro,
        quarteirao: r.quarteirao,
        imoveis_inspecionados: inspecionados,
        imoveis_positivos: positivos,
        iip:
          inspecionados > 0
            ? Math.round((positivos / inspecionados) * 10000) / 100
            : 0,
        ibp:
          inspecionados > 0
            ? Math.round((depositosPositivos / inspecionados) * 10000) / 100
            : 0,
        total_focos: Number(r.total_focos),
        focos_a1: Number(r.focos_a1),
        focos_a2: Number(r.focos_a2),
        focos_b: Number(r.focos_b),
        focos_c: Number(r.focos_c),
        focos_d1: Number(r.focos_d1),
        focos_d2: Number(r.focos_d2),
        focos_e: Number(r.focos_e),
        larvicida_total_g: Number(r.larvicida_total_g ?? 0),
      };
    });
  }
}
