import { FilterSlaInput } from '@modules/sla/dtos/filter-sla.input';
import {
  SlaConfig,
  SlaFeriado,
  SlaFocoConfig,
} from '@modules/sla/entities/sla-config';
import {
  SlaOperacional,
  SlaOperacionalPaginated,
} from '@modules/sla/entities/sla-operacional';
import {
  SlaIminente,
  SlaReadRepository,
} from '@modules/sla/repositories/sla-read.repository';
import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import type { JsonObject } from '@shared/types/json';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaSlaMapper } from '../../mappers/prisma-sla.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(SlaReadRepository)
@Injectable()
export class PrismaSlaReadRepository implements SlaReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId?: string | null): Promise<SlaOperacional | null> {
    const raw = await this.prisma.client.sla_operacional.findFirst({
      // MT-08: filtra por cliente_id quando informado (impede IDOR cross-tenant)
      where: { id, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaSlaMapper.slaOperacionalToDomain(raw as any) : null;
  }

  async findAll(filters: FilterSlaInput): Promise<SlaOperacional[]> {
    const rows = await this.prisma.client.sla_operacional.findMany({
      where: this.buildWhere(filters),
      orderBy: { prazo_final: 'asc' },
    });
    return rows.map((r) => PrismaSlaMapper.slaOperacionalToDomain(r as any));
  }

  async findPaginated(
    filters: FilterSlaInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<SlaOperacionalPaginated> {
    const where = this.buildWhere(filters);
    const [rows, count] = await this.prisma.client.$transaction([
      this.prisma.client.sla_operacional.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey ?? 'prazo_final']: orderValue ?? 'asc' },
      }),
      this.prisma.client.sla_operacional.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: rows.map((r) => PrismaSlaMapper.slaOperacionalToDomain(r as any)),
      pagination,
    };
  }

  async findPainel(
    clienteId: string,
    operadorId?: string,
  ): Promise<SlaOperacional[]> {
    const rows = await this.prisma.client.sla_operacional.findMany({
      where: {
        cliente_id: clienteId,
        status: { in: ['pendente', 'em_atendimento'] },
        deleted_at: null,
        ...(operadorId && { operador_id: operadorId }),
      },
      orderBy: { prazo_final: 'asc' },
    });
    return rows.map((r) => PrismaSlaMapper.slaOperacionalToDomain(r as any));
  }

  async countPendentes(clienteId: string): Promise<{ total: number }> {
    const total = await this.prisma.client.sla_operacional.count({
      where: {
        cliente_id: clienteId,
        status: { in: ['pendente', 'em_atendimento'] },
        deleted_at: null,
      },
    });
    return { total };
  }

  async findConfig(clienteId: string): Promise<SlaConfig | null> {
    const raw = await this.prisma.client.sla_config.findFirst({
      where: { cliente_id: clienteId },
    });
    return raw ? PrismaSlaMapper.slaConfigToDomain(raw as any) : null;
  }

  async findConfigRegioes(
    clienteId: string,
  ): Promise<
    Array<{ id: string; regiaoId: string; config: JsonObject }>
  > {
    const rows = await this.prisma.client.sla_config_regiao.findMany({
      where: { cliente_id: clienteId },
    });
    return rows.map((r) => ({
      id: r.id,
      regiaoId: r.regiao_id,
      config: r.config as JsonObject,
    }));
  }

  async findFeriados(clienteId: string): Promise<SlaFeriado[]> {
    // MT-05/findFeriados: sempre filtra por cliente_id — nunca usa where vazio
    const rows = await this.prisma.client.sla_feriados.findMany({
      where: { cliente_id: clienteId },
      orderBy: { data: 'asc' },
    });
    return rows.map((r) => PrismaSlaMapper.slaFeriadoToDomain(r as any));
  }

  async findFocoConfig(clienteId: string): Promise<SlaFocoConfig[]> {
    const rows = await this.prisma.client.sla_foco_config.findMany({
      where: { cliente_id: clienteId },
    });
    return rows.map((r) => PrismaSlaMapper.slaFocoConfigToDomain(r as any));
  }

  async findErrosCriacao(
    clienteId: string,
    limit: number,
  ): Promise<
    Array<{ id: string; erro: string; criado_em: Date; contexto: unknown }>
  > {
    const rows = await this.prisma.client.sla_erros_criacao.findMany({
      where: { cliente_id: clienteId },
      orderBy: { criado_em: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      erro: r.erro,
      criado_em: r.criado_em,
      contexto: r.contexto,
    }));
  }

  async findIminentes(clienteId: string): Promise<SlaIminente[]> {
    type Row = {
      id: string;
      cliente_id: string;
      foco_risco_id: string | null;
      levantamento_item_id: string | null;
      prioridade: string;
      sla_horas: number;
      inicio: Date;
      prazo_final: Date;
      status: string;
      escalonado: boolean;
      escalonado_automatico: boolean;
      minutos_restantes: number;
      pct_consumido: number;
    };

    const rows = await this.prisma.client.$queryRaw<Row[]>`
      SELECT
        s.id,
        s.cliente_id,
        s.foco_risco_id,
        s.levantamento_item_id,
        s.prioridade,
        s.sla_horas,
        s.inicio,
        s.prazo_final,
        s.status,
        s.escalonado,
        s.escalonado_automatico,
        GREATEST(0, EXTRACT(EPOCH FROM (s.prazo_final - NOW())) / 60)::float8    AS minutos_restantes,
        CASE
          WHEN s.prazo_final > s.inicio
          THEN LEAST(
            100,
            ROUND(
              EXTRACT(EPOCH FROM (NOW() - s.inicio))
              / NULLIF(EXTRACT(EPOCH FROM (s.prazo_final - s.inicio)), 0)
              * 100,
              1
            )
          )
          ELSE 0
        END::float8                                                                 AS pct_consumido
      FROM sla_operacional s
      WHERE s.cliente_id = ${clienteId}::uuid
        AND s.status IN ('pendente', 'em_atendimento')
        AND s.deleted_at IS NULL
        AND EXTRACT(EPOCH FROM (s.prazo_final - NOW()))
            <= s.sla_horas * 3600 * 0.20
      ORDER BY s.prazo_final ASC
    `;

    return rows.map((r) => ({
      id: r.id,
      clienteId: r.cliente_id,
      itemId: r.foco_risco_id,
      levantamentoItemId: r.levantamento_item_id,
      prioridade: r.prioridade,
      slaHoras: Number(r.sla_horas),
      inicio: r.inicio,
      prazoFinal: r.prazo_final,
      status: r.status,
      escalonado: r.escalonado,
      escalonadoAutomatico: r.escalonado_automatico,
      minutosRestantes: Number(r.minutos_restantes),
      pctConsumido: Number(r.pct_consumido),
    }));
  }

  private buildWhere(filters: FilterSlaInput) {
    return {
      deleted_at: null,
      // MT-09: != null distingue null intencional (admin global) de UUID (tenant filter)
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.operadorId && { operador_id: filters.operadorId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.prioridade && { prioridade: filters.prioridade }),
      ...(filters.focoRiscoId && { foco_risco_id: filters.focoRiscoId }),
      ...(filters.violado !== undefined && { violado: filters.violado }),
    };
  }
}
