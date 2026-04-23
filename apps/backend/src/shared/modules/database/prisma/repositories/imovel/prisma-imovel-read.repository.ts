import { FilterImovelInput } from '@modules/imovel/dtos/filter-imovel.input';
import { Imovel, ImovelPaginated } from '@modules/imovel/entities/imovel';
import {
  ImovelHistoricoAcesso,
  ImovelReadRepository,
  ImovelResumo,
  ScoreConfig,
  ScoreInputs,
} from '@modules/imovel/repositories/imovel-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaImovelMapper } from '../../mappers/prisma-imovel.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ImovelReadRepository)
@Injectable()
export class PrismaImovelReadRepository implements ImovelReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId?: string | null): Promise<Imovel | null> {
    const raw = await this.prisma.client.imoveis.findFirst({
      // MT-08: filtra por cliente_id quando informado (impede IDOR cross-tenant)
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaImovelMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterImovelInput): Promise<Imovel[]> {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.client.imoveis.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => PrismaImovelMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterImovelInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<ImovelPaginated> {
    const where = this.buildWhere(filters);
    const [items, count] = await this.prisma.client.$transaction([
      this.prisma.client.imoveis.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey]: orderValue },
      }),
      this.prisma.client.imoveis.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: items.map((r) => PrismaImovelMapper.toDomain(r as any)),
      pagination,
    };
  }

  async findScoreInputs(imovelId: string, clienteId: string): Promise<ScoreInputs> {
    const [imovelRaw, configRaw] = await Promise.all([
      // MT-08: inclui cliente_id no WHERE para prevenir acesso cross-tenant
      this.prisma.client.imoveis.findFirst({ where: { id: imovelId, cliente_id: clienteId, deleted_at: null } }),
      this.prisma.client.score_config.findUnique({ where: { cliente_id: clienteId } }),
    ]);

    const janelaResolucaoDias = configRaw?.janela_resolucao_dias ?? 30;
    const janelaVistoriaDias = configRaw?.janela_vistoria_dias ?? 45;
    const janelaCasoDias = configRaw?.janela_caso_dias ?? 60;
    const janelaResolucaoDate = new Date(Date.now() - janelaResolucaoDias * 86400000);
    const janelaVistoriaDate = new Date(Date.now() - janelaVistoriaDias * 86400000);
    const janelaCasoDate = new Date(Date.now() - janelaCasoDias * 86400000);

    const [
      focosAtivos,
      // SQL 2.4: COUNT total histórico, SEM filtro de janela.
      historicoFocosCount,
      // SQL 2.5: focos resolvidos dentro da janela_resolucao_dias
      focosResolvidosCount,
      // SQL 2.9: slas violados vinculados ao imóvel via foco_risco, SEM filtro de status
      slaVencidosCount,
      // SQL 2.11: vistoria com acesso=true, SEM depósitos com focos, dentro da janela_vistoria_dias
      vistoriasNegativasCount,
      // SQL 2.8: focos de cidadão ATIVOS (sem janela de tempo)
      denunciaCidadaoCount,
    ] = await Promise.all([
      // SQL 2.1 + 2.2 + 2.3: todos focos não-terminais para filtrar por status no use-case
      this.prisma.client.focos_risco.findMany({
        where: {
          imovel_id: imovelId,
          cliente_id: clienteId,
          deleted_at: null,
          status: { notIn: ['resolvido', 'descartado'] },
        },
        select: { status: true, foco_anterior_id: true },
      }),
      this.prisma.client.focos_risco.count({
        where: {
          imovel_id: imovelId,
          cliente_id: clienteId,
          deleted_at: null,
          // SEM filtro de created_at — paridade SQL 2.4
        },
      }),
      this.prisma.client.focos_risco.count({
        where: {
          imovel_id: imovelId,
          cliente_id: clienteId,
          deleted_at: null,
          status: 'resolvido',
          resolvido_em: { gte: janelaResolucaoDate },
        },
      }),
      // SQL 2.9: JOIN implícito via relação foco_risco → imovel_id; sem filtro de status
      this.prisma.client.sla_operacional.count({
        where: {
          cliente_id: clienteId,
          violado: true,
          deleted_at: null,
          foco_risco: { imovel_id: imovelId },
        },
      }),
      // SQL 2.11: acesso_realizado=TRUE + NONE de depósitos com focos
      this.prisma.client.vistorias.count({
        where: {
          imovel_id: imovelId,
          cliente_id: clienteId,
          deleted_at: null,
          acesso_realizado: true,
          created_at: { gte: janelaVistoriaDate },
          depositos: { none: { qtd_com_focos: { gt: 0 } } },
        },
      }),
      // SQL 2.8: origem_tipo='cidadao', status ativo, SEM janela de tempo
      this.prisma.client.focos_risco.count({
        where: {
          imovel_id: imovelId,
          cliente_id: clienteId,
          deleted_at: null,
          origem_tipo: 'cidadao',
          status: { notIn: ['resolvido', 'descartado'] },
        },
      }),
    ]);

    // SQL 2.6: bounding-box aproximado de 300m (~0.003°). Filtros faltantes adicionados:
    // status IN ('suspeito','confirmado') e janela created_at.
    // DÉBITO: bounding box é aproximação; PostGIS exato fica para fase futura.
    let casosProximosCount = 0;
    if (imovelRaw?.latitude != null && imovelRaw?.longitude != null) {
      casosProximosCount = await this.prisma.client.casos_notificados.count({
        where: {
          cliente_id: clienteId,
          deleted_at: null,
          status: { in: ['suspeito', 'confirmado'] },
          created_at: { gte: janelaCasoDate },
          latitude: { gte: imovelRaw.latitude - 0.003, lte: imovelRaw.latitude + 0.003 },
          longitude: { gte: imovelRaw.longitude - 0.003, lte: imovelRaw.longitude + 0.003 },
        },
      });
    }

    // SQL 2.7: clima via pluvio. Threshold exato do SQL: chuva > 60, temp > 30.
    // DIVERGÊNCIA: SQL usa poi.cliente_id, mas pluvio_operacional_item não tem esse campo
    // no schema atual — usando por.cliente_id (pluvio_operacional_run) que existe.
    let chuvaAlta = false;
    let tempAlta = false;
    if (imovelRaw?.bairro != null || imovelRaw?.regiao_id != null) {
      type PluvioRow = { chuva_7d_mm: number | null; temp_media_c: number | null };
      const bairroCond = imovelRaw?.bairro
        ? Prisma.sql`poi.bairro_nome = ${imovelRaw.bairro}`
        : Prisma.sql`false`;
      const regiaoCond = imovelRaw?.regiao_id
        ? Prisma.sql`poi.regiao_id = ${imovelRaw.regiao_id}::uuid`
        : Prisma.sql`false`;
      const pluvioRows = await this.prisma.client.$queryRaw<PluvioRow[]>`
        SELECT poi.chuva_7d_mm::float8, poi.temp_media_c::float8
        FROM pluvio_operacional_item poi
        JOIN pluvio_operacional_run por ON por.id = poi.run_id
        WHERE por.cliente_id = ${clienteId}::uuid
          AND (${bairroCond} OR ${regiaoCond})
        ORDER BY por.created_at DESC
        LIMIT 1
      `;
      if (pluvioRows.length) {
        // SQL: COALESCE(chuva_7d_mm,0) > 60 (estrito), COALESCE(temp_media_c,0) > 30 (estrito)
        chuvaAlta = (pluvioRows[0].chuva_7d_mm ?? 0) > 60;
        tempAlta = (pluvioRows[0].temp_media_c ?? 0) > 30;
      }
    }

    const imovel = imovelRaw ? PrismaImovelMapper.toDomain(imovelRaw as any) : null;

    const config: ScoreConfig | null = configRaw
      ? {
          pesoFocoSuspeito: configRaw.peso_foco_suspeito,
          pesoFocoConfirmado: configRaw.peso_foco_confirmado,
          pesoFocoEmTratamento: configRaw.peso_foco_em_tratamento,
          pesoFocoRecorrente: configRaw.peso_foco_recorrente,
          pesoHistorico3focos: configRaw.peso_historico_3focos,
          pesoCaso300m: configRaw.peso_caso_300m,
          pesoChuvaAlta: configRaw.peso_chuva_alta,
          pesoTemperatura30: configRaw.peso_temperatura_30,
          pesoDenunciaCidadao: configRaw.peso_denuncia_cidadao,
          pesoSlaVencido: configRaw.peso_sla_vencido,
          pesoVistoriaNegativa: configRaw.peso_vistoria_negativa,
          pesoImovelRecusa: configRaw.peso_imovel_recusa,
          pesoFocoResolvido: configRaw.peso_foco_resolvido,
          janelaResolucaoDias,
          janelaVistoriaDias,
          janelaCasoDias,
          capFocos: configRaw.cap_focos,
          capEpidemio: configRaw.cap_epidemio,
          capHistorico: configRaw.cap_historico,
        }
      : null;

    return {
      imovel,
      config,
      focosAtivos: focosAtivos.map((f) => ({
        status: f.status,
        focoAnteriorId: f.foco_anterior_id,
      })),
      historicoFocosCount,
      focosResolvidosCount,
      slaVencidosCount,
      vistoriasNegativasCount,
      casosProximosCount,
      denunciaCidadaoCount,
      chuvaAlta,
      tempAlta,
    };
  }

  async findScoreConfig(clienteId: string): Promise<ScoreConfig | null> {
    const configRaw = await this.prisma.client.score_config.findUnique({
      where: { cliente_id: clienteId },
    });
    if (!configRaw) return null;
    return {
      pesoFocoSuspeito: configRaw.peso_foco_suspeito,
      pesoFocoConfirmado: configRaw.peso_foco_confirmado,
      pesoFocoEmTratamento: configRaw.peso_foco_em_tratamento,
      pesoFocoRecorrente: configRaw.peso_foco_recorrente,
      pesoHistorico3focos: configRaw.peso_historico_3focos,
      pesoCaso300m: configRaw.peso_caso_300m,
      pesoChuvaAlta: configRaw.peso_chuva_alta,
      pesoTemperatura30: configRaw.peso_temperatura_30,
      pesoDenunciaCidadao: configRaw.peso_denuncia_cidadao,
      pesoSlaVencido: configRaw.peso_sla_vencido,
      pesoVistoriaNegativa: configRaw.peso_vistoria_negativa,
      pesoImovelRecusa: configRaw.peso_imovel_recusa,
      pesoFocoResolvido: configRaw.peso_foco_resolvido,
      janelaResolucaoDias: configRaw.janela_resolucao_dias,
      janelaVistoriaDias: configRaw.janela_vistoria_dias,
      janelaCasoDias: configRaw.janela_caso_dias,
      capFocos: configRaw.cap_focos,
      capEpidemio: configRaw.cap_epidemio,
      capHistorico: configRaw.cap_historico,
    };
  }

  async listResumo(clienteId: string, regiaoId?: string): Promise<ImovelResumo[]> {
    type Row = {
      id: string;
      cliente_id: string;
      logradouro: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      quarteirao: string | null;
      regiao_id: string | null;
      tipo_imovel: string;
      latitude: number | null;
      longitude: number | null;
      ativo: boolean;
      historico_recusa: boolean;
      prioridade_drone: boolean;
      tem_calha: boolean;
      calha_acessivel: boolean;
      created_at: string;
      updated_at: string;
      total_vistorias: bigint;
      ultima_visita: string | null;
      tentativas_sem_acesso: bigint;
      total_focos_historico: bigint;
      focos_ativos: bigint;
      ultimo_foco_em: string | null;
      slas_abertos: bigint;
      focos_recorrentes: bigint;
      score_territorial: number | null;
      score_classificacao: string | null;
      score_fatores: Record<string, unknown> | null;
      score_calculado_em: string | null;
    };

    const regiaoFilter = regiaoId
      ? Prisma.sql`AND i.regiao_id = ${regiaoId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        i.id::text,
        i.cliente_id::text,
        i.logradouro,
        i.numero,
        i.complemento,
        i.bairro,
        i.quarteirao,
        i.regiao_id::text,
        i.tipo_imovel,
        i.latitude::float8,
        i.longitude::float8,
        i.ativo,
        i.historico_recusa,
        i.prioridade_drone,
        i.tem_calha,
        i.calha_acessivel,
        i.created_at::text,
        i.updated_at::text,
        COALESCE(v.total_vistorias, 0)       AS total_vistorias,
        v.ultima_visita,
        COALESCE(v.tentativas_sem_acesso, 0) AS tentativas_sem_acesso,
        COALESCE(f.total_focos_historico, 0) AS total_focos_historico,
        COALESCE(f.focos_ativos, 0)          AS focos_ativos,
        f.ultimo_foco_em,
        COALESCE(sla.slas_abertos, 0)        AS slas_abertos,
        COALESCE(f.focos_recorrentes, 0)     AS focos_recorrentes,
        ts.score::float8                     AS score_territorial,
        ts.classificacao                     AS score_classificacao,
        ts.fatores                           AS score_fatores,
        ts.calculado_em::text                AS score_calculado_em
      FROM imoveis i
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                                          AS total_vistorias,
          MAX(created_at)::text                             AS ultima_visita,
          COUNT(*) FILTER (WHERE acesso_realizado = false)  AS tentativas_sem_acesso
        FROM vistorias
        WHERE imovel_id = i.id AND deleted_at IS NULL
      ) v ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                                                           AS total_focos_historico,
          COUNT(*) FILTER (WHERE status NOT IN ('resolvido', 'descartado')) AS focos_ativos,
          MAX(created_at)::text                                              AS ultimo_foco_em,
          COUNT(*) FILTER (WHERE foco_anterior_id IS NOT NULL)              AS focos_recorrentes
        FROM focos_risco
        WHERE imovel_id = i.id AND deleted_at IS NULL
      ) f ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS slas_abertos
        FROM sla_operacional sl
        JOIN focos_risco fr ON fr.id = sl.foco_risco_id
        WHERE fr.imovel_id = i.id
          AND fr.deleted_at IS NULL
          AND sl.status != 'concluido'
          AND sl.deleted_at IS NULL
      ) sla ON true
      LEFT JOIN territorio_score ts ON ts.imovel_id = i.id AND ts.cliente_id = i.cliente_id
      WHERE i.cliente_id = ${clienteId}::uuid
        AND i.deleted_at IS NULL
        AND i.ativo = true
        ${regiaoFilter}
      ORDER BY ts.score DESC NULLS LAST
    `;

    return rows.map((r) => ({
      id: r.id,
      clienteId: r.cliente_id,
      logradouro: r.logradouro,
      numero: r.numero,
      complemento: r.complemento,
      bairro: r.bairro,
      quarteirao: r.quarteirao,
      regiaoId: r.regiao_id,
      tipoImovel: r.tipo_imovel,
      latitude: r.latitude,
      longitude: r.longitude,
      ativo: r.ativo,
      historicoRecusa: r.historico_recusa,
      prioridadeDrone: r.prioridade_drone,
      temCalha: r.tem_calha,
      calhaAcessivel: r.calha_acessivel,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      totalVistorias: Number(r.total_vistorias),
      ultimaVisita: r.ultima_visita,
      tentativasSemAcesso: Number(r.tentativas_sem_acesso),
      totalFocosHistorico: Number(r.total_focos_historico),
      focosAtivos: Number(r.focos_ativos),
      ultimoFocoEm: r.ultimo_foco_em,
      slasAbertos: Number(r.slas_abertos),
      focosRecorrentes: Number(r.focos_recorrentes),
      scoreTerritorial: r.score_territorial,
      scoreClassificacao: r.score_classificacao,
      scoreFatores: r.score_fatores,
      scoreCalculadoEm: r.score_calculado_em,
    }));
  }

  async getResumoById(id: string, clienteId?: string | null): Promise<ImovelResumo | null> {
    type Row = {
      id: string;
      cliente_id: string;
      logradouro: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      quarteirao: string | null;
      regiao_id: string | null;
      tipo_imovel: string;
      latitude: number | null;
      longitude: number | null;
      ativo: boolean;
      historico_recusa: boolean;
      prioridade_drone: boolean;
      tem_calha: boolean;
      calha_acessivel: boolean;
      created_at: string;
      updated_at: string;
      total_vistorias: bigint;
      ultima_visita: string | null;
      tentativas_sem_acesso: bigint;
      total_focos_historico: bigint;
      focos_ativos: bigint;
      ultimo_foco_em: string | null;
      slas_abertos: bigint;
      focos_recorrentes: bigint;
      score_territorial: number | null;
      score_classificacao: string | null;
      score_fatores: Record<string, unknown> | null;
      score_calculado_em: string | null;
    };

    // MT-05: filtro de tenant no raw SQL (impede leitura cross-tenant por ID)
    const tenantFilter = clienteId != null
      ? Prisma.sql`AND i.cliente_id = ${clienteId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        i.id::text,
        i.cliente_id::text,
        i.logradouro,
        i.numero,
        i.complemento,
        i.bairro,
        i.quarteirao,
        i.regiao_id::text,
        i.tipo_imovel,
        i.latitude::float8,
        i.longitude::float8,
        i.ativo,
        i.historico_recusa,
        i.prioridade_drone,
        i.tem_calha,
        i.calha_acessivel,
        i.created_at::text,
        i.updated_at::text,
        COALESCE(v.total_vistorias, 0)       AS total_vistorias,
        v.ultima_visita,
        COALESCE(v.tentativas_sem_acesso, 0) AS tentativas_sem_acesso,
        COALESCE(f.total_focos_historico, 0) AS total_focos_historico,
        COALESCE(f.focos_ativos, 0)          AS focos_ativos,
        f.ultimo_foco_em,
        COALESCE(sla.slas_abertos, 0)        AS slas_abertos,
        COALESCE(f.focos_recorrentes, 0)     AS focos_recorrentes,
        ts.score::float8                     AS score_territorial,
        ts.classificacao                     AS score_classificacao,
        ts.fatores                           AS score_fatores,
        ts.calculado_em::text                AS score_calculado_em
      FROM imoveis i
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                                          AS total_vistorias,
          MAX(created_at)::text                             AS ultima_visita,
          COUNT(*) FILTER (WHERE acesso_realizado = false)  AS tentativas_sem_acesso
        FROM vistorias
        WHERE imovel_id = i.id AND deleted_at IS NULL
      ) v ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                                                           AS total_focos_historico,
          COUNT(*) FILTER (WHERE status NOT IN ('resolvido', 'descartado')) AS focos_ativos,
          MAX(created_at)::text                                              AS ultimo_foco_em,
          COUNT(*) FILTER (WHERE foco_anterior_id IS NOT NULL)              AS focos_recorrentes
        FROM focos_risco
        WHERE imovel_id = i.id AND deleted_at IS NULL
      ) f ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS slas_abertos
        FROM sla_operacional sl
        JOIN focos_risco fr ON fr.id = sl.foco_risco_id
        WHERE fr.imovel_id = i.id
          AND fr.deleted_at IS NULL
          AND sl.status != 'concluido'
          AND sl.deleted_at IS NULL
      ) sla ON true
      LEFT JOIN territorio_score ts ON ts.imovel_id = i.id AND ts.cliente_id = i.cliente_id
      WHERE i.id = ${id}::uuid
        AND i.deleted_at IS NULL
        ${tenantFilter}
    `;

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      clienteId: r.cliente_id,
      logradouro: r.logradouro,
      numero: r.numero,
      complemento: r.complemento,
      bairro: r.bairro,
      quarteirao: r.quarteirao,
      regiaoId: r.regiao_id,
      tipoImovel: r.tipo_imovel,
      latitude: r.latitude,
      longitude: r.longitude,
      ativo: r.ativo,
      historicoRecusa: r.historico_recusa,
      prioridadeDrone: r.prioridade_drone,
      temCalha: r.tem_calha,
      calhaAcessivel: r.calha_acessivel,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      totalVistorias: Number(r.total_vistorias),
      ultimaVisita: r.ultima_visita,
      tentativasSemAcesso: Number(r.tentativas_sem_acesso),
      totalFocosHistorico: Number(r.total_focos_historico),
      focosAtivos: Number(r.focos_ativos),
      ultimoFocoEm: r.ultimo_foco_em,
      slasAbertos: Number(r.slas_abertos),
      focosRecorrentes: Number(r.focos_recorrentes),
      scoreTerritorial: r.score_territorial,
      scoreClassificacao: r.score_classificacao,
      scoreFatores: r.score_fatores,
      scoreCalculadoEm: r.score_calculado_em,
    };
  }

  async listProblematicos(clienteId: string): Promise<ImovelHistoricoAcesso[]> {
    type Row = {
      imovel_id: string;
      cliente_id: string;
      logradouro: string | null;
      numero: string | null;
      bairro: string | null;
      quarteirao: string | null;
      proprietario_ausente: boolean;
      tipo_ausencia: string | null;
      tem_animal_agressivo: boolean;
      historico_recusa: boolean;
      prioridade_drone: boolean;
      tem_calha: boolean;
      calha_acessivel: boolean;
      notificacao_formal_em: string | null;
      total_visitas: bigint;
      total_sem_acesso: bigint;
      pct_sem_acesso: number;
      ultima_visita_com_acesso: string | null;
      ultima_tentativa: string | null;
      requer_notificacao_formal: boolean;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        i.id::text                                                                   AS imovel_id,
        i.cliente_id::text,
        i.logradouro,
        i.numero,
        i.bairro,
        i.quarteirao,
        i.proprietario_ausente,
        i.tipo_ausencia,
        i.tem_animal_agressivo,
        i.historico_recusa,
        i.prioridade_drone,
        i.tem_calha,
        i.calha_acessivel,
        i.notificacao_formal_em::text,
        COALESCE(v.total_visitas, 0)                                                 AS total_visitas,
        COALESCE(v.total_sem_acesso, 0)                                              AS total_sem_acesso,
        v.pct_sem_acesso,
        v.ultima_visita_com_acesso,
        v.ultima_tentativa,
        (i.historico_recusa = true AND i.notificacao_formal_em IS NULL)              AS requer_notificacao_formal
      FROM imoveis i
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                                                                       AS total_visitas,
          COUNT(*) FILTER (WHERE acesso_realizado = false)                              AS total_sem_acesso,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(
              COUNT(*) FILTER (WHERE acesso_realizado = false)::numeric / COUNT(*) * 100,
              1
            )
            ELSE 0
          END::float8                                                                   AS pct_sem_acesso,
          (MAX(created_at) FILTER (WHERE acesso_realizado = true))::text               AS ultima_visita_com_acesso,
          MAX(created_at)::text                                                         AS ultima_tentativa
        FROM vistorias
        WHERE imovel_id = i.id AND deleted_at IS NULL
      ) v ON true
      WHERE i.cliente_id = ${clienteId}::uuid
        AND i.deleted_at IS NULL
        AND i.ativo = true
        AND (
          i.historico_recusa = true
          OR EXISTS (
            SELECT 1 FROM vistorias vv
            WHERE vv.imovel_id = i.id AND vv.deleted_at IS NULL AND vv.acesso_realizado = false
          )
        )
      ORDER BY v.pct_sem_acesso DESC NULLS LAST
    `;

    return rows.map((r) => ({
      imovelId: r.imovel_id,
      clienteId: r.cliente_id,
      logradouro: r.logradouro,
      numero: r.numero,
      bairro: r.bairro,
      quarteirao: r.quarteirao,
      proprietarioAusente: r.proprietario_ausente,
      tipoAusencia: r.tipo_ausencia,
      temAnimalAgressivo: r.tem_animal_agressivo,
      historicoRecusa: r.historico_recusa,
      prioridadeDrone: r.prioridade_drone,
      temCalha: r.tem_calha,
      calhaAcessivel: r.calha_acessivel,
      notificacaoFormalEm: r.notificacao_formal_em,
      totalVisitas: Number(r.total_visitas),
      totalSemAcesso: Number(r.total_sem_acesso),
      pctSemAcesso: Number(r.pct_sem_acesso),
      ultimaVisitaComAcesso: r.ultima_visita_com_acesso,
      ultimaTentativa: r.ultima_tentativa,
      requerNotificacaoFormal: r.requer_notificacao_formal,
    }));
  }

  private buildWhere(filters: FilterImovelInput) {
    return {
      deleted_at: null,
      // MT-09: != null distingue null intencional (admin global) de UUID (tenant filter)
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.regiaoId && { regiao_id: filters.regiaoId }),
      ...(filters.bairro && {
        bairro: { contains: filters.bairro, mode: 'insensitive' as const },
      }),
      ...(filters.tipoImovel && { tipo_imovel: filters.tipoImovel }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
    };
  }
}
