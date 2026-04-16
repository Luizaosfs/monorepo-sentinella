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

  async findById(id: string): Promise<Imovel | null> {
    const raw = await this.prisma.client.imoveis.findFirst({
      where: { id, deleted_at: null },
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
      this.prisma.client.imoveis.findFirst({ where: { id: imovelId, deleted_at: null } }),
      this.prisma.client.score_config.findUnique({ where: { cliente_id: clienteId } }),
    ]);

    const janela = configRaw?.janela_resolucao_dias ?? 30;
    const janelaDate = new Date(Date.now() - janela * 86400000);

    const [focosAtivos, focosResolvidosCount, slaVencidosCount, vistoriasNegativasCount] =
      await Promise.all([
        this.prisma.client.focos_risco.findMany({
          where: {
            imovel_id: imovelId,
            deleted_at: null,
            status: { notIn: ['resolvido', 'descartado'] },
          },
          select: { status: true, foco_anterior_id: true },
        }),
        this.prisma.client.focos_risco.count({
          where: {
            imovel_id: imovelId,
            deleted_at: null,
            status: 'resolvido',
            resolvido_em: { gte: janelaDate },
          },
        }),
        this.prisma.client.sla_operacional.count({
          where: {
            cliente_id: clienteId,
            violado: true,
            deleted_at: null,
            status: { not: 'concluido' },
          },
        }),
        this.prisma.client.vistorias.count({
          where: {
            imovel_id: imovelId,
            deleted_at: null,
            acesso_realizado: true,
            created_at: { gte: janelaDate },
          },
        }),
      ]);

    let casosProximosCount = 0;
    if (imovelRaw?.latitude != null && imovelRaw?.longitude != null) {
      casosProximosCount = await this.prisma.client.casos_notificados.count({
        where: {
          cliente_id: clienteId,
          latitude: { gte: imovelRaw.latitude - 0.003, lte: imovelRaw.latitude + 0.003 },
          longitude: { gte: imovelRaw.longitude - 0.003, lte: imovelRaw.longitude + 0.003 },
        },
      });
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
          pesoSlaVencido: configRaw.peso_sla_vencido,
          pesoVistoriaNegativa: configRaw.peso_vistoria_negativa,
          pesoImovelRecusa: configRaw.peso_imovel_recusa,
          pesoFocoResolvido: configRaw.peso_foco_resolvido,
          janelaDias: configRaw.janela_resolucao_dias,
        }
      : null;

    return {
      imovel,
      config,
      focosAtivos: focosAtivos.map((f) => ({
        status: f.status,
        focoAnteriorId: f.foco_anterior_id,
      })),
      historicoFocosCount: focosResolvidosCount,
      focosResolvidosCount,
      slaVencidosCount,
      vistoriasNegativasCount,
      casosProximosCount,
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

  async getResumoById(id: string): Promise<ImovelResumo | null> {
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
      ...(filters.clienteId && { cliente_id: filters.clienteId }),
      ...(filters.regiaoId && { regiao_id: filters.regiaoId }),
      ...(filters.bairro && {
        bairro: { contains: filters.bairro, mode: 'insensitive' as const },
      }),
      ...(filters.tipoImovel && { tipo_imovel: filters.tipoImovel }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
    };
  }
}
