import { FilterFocoRiscoInput } from '@modules/foco-risco/dtos/filter-foco-risco.input';
import {
  FocoRisco,
  FocoRiscoPaginated,
} from '@modules/foco-risco/entities/foco-risco';
import {
  ContagemTriagemResult,
  FocoRiscoReadRepository,
  ScoreInputsRow,
  TimelineItem,
} from '@modules/foco-risco/repositories/foco-risco-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaFocoRiscoMapper } from '../../mappers/prisma-foco-risco.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(FocoRiscoReadRepository)
@Injectable()
export class PrismaFocoRiscoReadRepository implements FocoRiscoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId?: string | null): Promise<FocoRisco | null> {
    const raw = await this.prisma.client.focos_risco.findFirst({
      // MT-06: filtra por cliente_id quando informado (impede IDOR cross-tenant)
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaFocoRiscoMapper.toDomain(raw) : null;
  }

  async findByIdComHistorico(id: string, clienteId?: string | null): Promise<FocoRisco | null> {
    const raw = await this.prisma.client.focos_risco.findFirst({
      // MT-06: filtra por cliente_id quando informado (impede IDOR cross-tenant)
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
      include: { historico: { orderBy: { alterado_em: 'asc' } } },
    });
    return raw ? PrismaFocoRiscoMapper.toDomain(raw) : null;
  }

  async findAll(filters: FilterFocoRiscoInput): Promise<FocoRisco[]> {
    const rows = await this.prisma.client.focos_risco.findMany({
      where: this.buildWhere(filters),
      orderBy: { created_at: 'desc' },
    });
    return this.attachImageUrls(rows.map((r) => PrismaFocoRiscoMapper.toDomain(r)), rows);
  }

  async findPaginated(
    filters: FilterFocoRiscoInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<FocoRiscoPaginated> {
    const where = this.buildWhere(filters);
    const [items, count] = await this.prisma.client.$transaction([
      this.prisma.client.focos_risco.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: [{ [orderKey]: orderValue }, { created_at: 'asc' }],
      }),
      this.prisma.client.focos_risco.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: await this.attachImageUrls(items.map((r) => PrismaFocoRiscoMapper.toDomain(r as any)), items),
      pagination,
    };
  }

  /** Batch-carrega image_url de levantamento_itens e anexa em cada foco. */
  private async attachImageUrls(
    focos: FocoRisco[],
    rows: Array<{ origem_levantamento_item_id?: string | null }>,
  ): Promise<FocoRisco[]> {
    const ids = rows
      .map((r) => r.origem_levantamento_item_id)
      .filter((id): id is string => !!id);
    if (!ids.length) return focos;
    const itens = await this.prisma.client.levantamento_itens.findMany({
      where: { id: { in: ids } },
      select: { id: true, image_url: true },
    });
    const imageMap = new Map(itens.map((i) => [i.id, i.image_url]));
    for (let i = 0; i < focos.length; i++) {
      const itemId = rows[i].origem_levantamento_item_id;
      focos[i].origemImageUrl = itemId ? (imageMap.get(itemId) ?? null) : null;
    }
    return focos;
  }

  async findManyByIds(ids: string[], clienteId: string): Promise<FocoRisco[]> {
    const rows = await this.prisma.client.focos_risco.findMany({
      where: { id: { in: ids }, cliente_id: clienteId, deleted_at: null },
    });
    return rows.map((r) => PrismaFocoRiscoMapper.toDomain(r));
  }

  async findContagemTriagem(filters: FilterFocoRiscoInput): Promise<ContagemTriagemResult> {
    type Row = {
      total: bigint;
      suspeita: bigint;
      em_triagem: bigint;
      aguarda_inspecao: bigint;
      em_inspecao: bigint;
      p1p2: bigint;
      sem_responsavel: bigint;
    };

    if (!filters.clienteId) {
      return { total: 0, suspeita: 0, em_triagem: 0, aguarda_inspecao: 0, em_inspecao: 0, p1p2: 0, sem_responsavel: 0 };
    }

    const regiaoFilter = filters.regiaoId
      ? Prisma.sql`AND regiao_id = ${filters.regiaoId}::uuid`
      : Prisma.empty;
    const responsavelFilter = filters.responsavelId
      ? Prisma.sql`AND responsavel_id = ${filters.responsavelId}::uuid`
      : Prisma.empty;
    const origemFilter = filters.origemTipo
      ? Prisma.sql`AND origem_tipo = ${filters.origemTipo}`
      : Prisma.empty;

    const [row] = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        COUNT(*)                                                                   AS total,
        COUNT(*) FILTER (WHERE status = 'suspeita')                               AS suspeita,
        COUNT(*) FILTER (WHERE status = 'em_triagem')                             AS em_triagem,
        COUNT(*) FILTER (WHERE status = 'aguarda_inspecao')                       AS aguarda_inspecao,
        COUNT(*) FILTER (WHERE status = 'em_inspecao')                            AS em_inspecao,
        COUNT(*) FILTER (WHERE prioridade IN ('critica', 'alta', 'P1', 'P2'))     AS p1p2,
        COUNT(*) FILTER (WHERE responsavel_id IS NULL)                            AS sem_responsavel
      FROM focos_risco
      WHERE cliente_id = ${filters.clienteId}::uuid
        AND deleted_at IS NULL
        AND status NOT IN ('resolvido', 'descartado')
        ${regiaoFilter}
        ${responsavelFilter}
        ${origemFilter}
    `;

    return {
      total: Number(row.total),
      suspeita: Number(row.suspeita),
      em_triagem: Number(row.em_triagem),
      aguarda_inspecao: Number(row.aguarda_inspecao),
      em_inspecao: Number(row.em_inspecao),
      p1p2: Number(row.p1p2),
      sem_responsavel: Number(row.sem_responsavel),
    };
  }

  async findContagemPorStatus(clienteId: string): Promise<Record<string, number>> {
    type Row = { status: string; total: bigint };
    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT status, COUNT(*) AS total
      FROM focos_risco
      WHERE cliente_id = ${clienteId}::uuid
        AND deleted_at IS NULL
      GROUP BY status
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = Number(row.total);
    }
    return result;
  }

  async findTimeline(focoId: string): Promise<TimelineItem[]> {
    return this.prisma.client.$queryRaw<TimelineItem[]>`
      SELECT foco_risco_id, tipo, ts, titulo, descricao, ator_id, ref_id FROM (
        SELECT frh.foco_risco_id, 'estado'::text AS tipo, frh.alterado_em AS ts,
          ('Status: ' || COALESCE(frh.status_anterior,'novo') || ' → ' || COALESCE(frh.status_novo,'?')) AS titulo,
          frh.motivo AS descricao, frh.alterado_por AS ator_id, NULL::uuid AS ref_id
        FROM foco_risco_historico frh
        WHERE frh.foco_risco_id = ${focoId}::uuid
          AND COALESCE(frh.tipo_evento,'transicao_status') = 'transicao_status'
        UNION ALL
        SELECT frh.foco_risco_id, 'classificacao_alterada'::text, frh.alterado_em,
          ('Classificação: ' || COALESCE(frh.classificacao_anterior,'—') || ' → ' || COALESCE(frh.classificacao_nova,'?')),
          NULL, frh.alterado_por, NULL::uuid
        FROM foco_risco_historico frh
        WHERE frh.foco_risco_id = ${focoId}::uuid AND frh.tipo_evento = 'classificacao_alterada'
        UNION ALL
        SELECT fr.id, 'vistoria'::text, v.checkin_em,
          ('Vistoria: ' || v.tipo_atividade),
          CASE WHEN v.acesso_realizado = false THEN ('Sem acesso — ' || COALESCE(v.motivo_sem_acesso,'')) ELSE v.observacao END,
          v.agente_id, v.id
        FROM focos_risco fr
        JOIN vistorias v ON v.id = fr.origem_vistoria_id
        WHERE fr.id = ${focoId}::uuid
        UNION ALL
        SELECT fr.id, 'vistoria_campo'::text, v.checkin_em,
          ('Vistoria de campo: ' || v.tipo_atividade), v.observacao, v.agente_id, v.id
        FROM focos_risco fr
        JOIN vistorias v ON v.imovel_id = fr.imovel_id AND v.ciclo = fr.ciclo
          AND v.id <> COALESCE(fr.origem_vistoria_id,'00000000-0000-0000-0000-000000000000'::uuid)
        WHERE fr.id = ${focoId}::uuid AND fr.imovel_id IS NOT NULL AND fr.ciclo IS NOT NULL
        UNION ALL
        SELECT fr.id, 'sla'::text, COALESCE(sla.concluido_em, sla.prazo_final, sla.inicio),
          CASE sla.status
            WHEN 'aberto' THEN 'SLA aberto — prazo: ' || to_char(sla.prazo_final,'DD/MM/YYYY HH24:MI')
            WHEN 'concluido' THEN 'SLA concluído'
            WHEN 'vencido' THEN 'SLA vencido'
            ELSE sla.status
          END,
          ('Prioridade ' || sla.prioridade || ' — ' || sla.sla_horas || 'h'),
          NULL::uuid, sla.id
        FROM focos_risco fr
        JOIN sla_operacional sla ON sla.foco_risco_id = fr.id
        WHERE fr.id = ${focoId}::uuid
        UNION ALL
        SELECT fr.id, 'caso_notificado'::text, cn.data_notificacao::timestamptz,
          ('Caso notificado: ' || cn.doenca),
          ('Status: ' || cn.status || ' — ' || COALESCE(cn.bairro,'')),
          cn.notificador_id, cn.id
        FROM focos_risco fr
        JOIN casos_notificados cn ON cn.id = ANY(fr.casos_ids)
        WHERE fr.id = ${focoId}::uuid
        UNION ALL
        SELECT r.foco_risco_id, 'reinspecao'::text,
          COALESCE(r.data_realizada, r.data_prevista, r.created_at),
          CASE r.status WHEN 'pendente' THEN 'Reinspeção pendente' WHEN 'realizada' THEN 'Reinspeção realizada' WHEN 'cancelada' THEN 'Reinspeção cancelada' ELSE 'Reinspeção' END,
          CASE WHEN r.resultado IS NOT NULL THEN ('Resultado: ' || r.resultado::text) WHEN r.status = 'cancelada' THEN COALESCE(r.motivo_cancelamento,'Cancelada') ELSE NULL END,
          r.responsavel_id, r.id
        FROM reinspecoes_programadas r
        WHERE r.foco_risco_id = ${focoId}::uuid
      ) timeline
      ORDER BY ts DESC NULLS LAST
    `;
  }

  async findInputsParaScorePrioridade(focoId: string): Promise<ScoreInputsRow | null> {
    const rows = await this.prisma.client.$queryRaw<ScoreInputsRow[]>(Prisma.sql`
      SELECT
        f.cliente_id AS "clienteId",
        f.status,
        f.foco_anterior_id AS "focoAnteriorId",
        f.latitude,
        f.longitude,
        sfc.prazo_minutos AS "prazoMinutos",
        EXTRACT(EPOCH FROM (now() - MAX(frh.alterado_em)))::integer / 60 AS "tempoNoEstadoMinutos",
        (
          SELECT COUNT(*)::integer
          FROM casos_notificados cn
          WHERE cn.cliente_id = f.cliente_id
            AND cn.deleted_at IS NULL
            AND f.latitude IS NOT NULL
            AND f.longitude IS NOT NULL
            AND cn.latitude IS NOT NULL
            AND cn.longitude IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(cn.longitude, cn.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(f.longitude, f.latitude), 4326)::geography,
              300
            )
        ) AS "casosProximosCount"
      FROM focos_risco f
      LEFT JOIN sla_foco_config sfc
        ON sfc.cliente_id = f.cliente_id
        AND sfc.ativo = true
        AND sfc.fase = CASE f.status
          WHEN 'suspeita'         THEN 'triagem'
          WHEN 'em_triagem'       THEN 'triagem'
          WHEN 'aguarda_inspecao' THEN 'triagem'
          WHEN 'em_inspecao'      THEN 'inspecao'
          WHEN 'confirmado'       THEN 'confirmacao'
          WHEN 'em_tratamento'    THEN 'tratamento'
          ELSE NULL
        END
      LEFT JOIN foco_risco_historico frh ON frh.foco_risco_id = f.id
      WHERE f.id = ${focoId}::uuid
        AND f.deleted_at IS NULL
      GROUP BY f.id, f.cliente_id, f.status, f.foco_anterior_id, f.latitude, f.longitude, sfc.prazo_minutos
    `);
    return rows[0] ?? null;
  }

  private buildWhere(filters: FilterFocoRiscoInput) {
    return {
      deleted_at: null,
      // != null distingue null intencional (admin global) de UUID (tenant filter).
      // undefined também passa sem filtro — controlado pelo TenantGuard + MT-02/03/04.
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.status?.length && {
        status: filters.status.length === 1
          ? filters.status[0]
          : { in: filters.status },
      }),
      ...(filters.prioridade?.length && {
        prioridade: filters.prioridade.length === 1
          ? filters.prioridade[0]
          : { in: filters.prioridade },
      }),
      ...(filters.regiaoId && { regiao_id: filters.regiaoId }),
      ...(filters.responsavelId && { responsavel_id: filters.responsavelId }),
      ...(filters.origemTipo && { origem_tipo: filters.origemTipo }),
    };
  }
}
