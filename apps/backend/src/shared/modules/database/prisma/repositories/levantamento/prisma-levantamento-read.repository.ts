import { FilterLevantamentoInput } from '@modules/levantamento/dtos/filter-levantamento.input';
import {
  Levantamento,
  LevantamentoItem,
  LevantamentoPaginated,
} from '@modules/levantamento/entities/levantamento';
import {
  ItemEvidencia,
  LevantamentoReadRepository,
  PlanejamentoInfo,
  SlaConfigInfo,
} from '@modules/levantamento/repositories/levantamento-read.repository';
import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaLevantamentoMapper } from '../../mappers/prisma-levantamento.mapper';
import { PrismaService } from '../../prisma.service';

const INCLUDE_ITENS = {
  itens: {
    include: {
      detecoes: true,
      evidencias: true,
    },
  },
} as const;

@PrismaRepository(LevantamentoReadRepository)
@Injectable()
export class PrismaLevantamentoReadRepository implements LevantamentoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Levantamento | null> {
    const raw = await this.prisma.client.levantamentos.findFirst({
      where: { id, deleted_at: null },
    });
    return raw ? PrismaLevantamentoMapper.toDomain(raw as any) : null;
  }

  async findByIdComItens(id: string): Promise<Levantamento | null> {
    const raw = await this.prisma.client.levantamentos.findFirst({
      where: { id, deleted_at: null },
      include: INCLUDE_ITENS,
    });
    return raw ? PrismaLevantamentoMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterLevantamentoInput): Promise<Levantamento[]> {
    const rows = await this.prisma.client.levantamentos.findMany({
      where: this.buildWhere(filters),
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => PrismaLevantamentoMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterLevantamentoInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<LevantamentoPaginated> {
    const where = this.buildWhere(filters);
    const [items, count] = await this.prisma.client.$transaction([
      this.prisma.client.levantamentos.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey]: orderValue },
      }),
      this.prisma.client.levantamentos.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: items.map((r) => PrismaLevantamentoMapper.toDomain(r as any)),
      pagination,
    };
  }

  async findItemById(id: string): Promise<LevantamentoItem | null> {
    const raw = await this.prisma.client.levantamento_itens.findFirst({
      where: { id, deleted_at: null },
      include: { detecoes: true, evidencias: true },
    });
    return raw ? PrismaLevantamentoMapper.itemToDomain(raw as any) : null;
  }

  async findItensByLevantamentoId(
    levantamentoId: string,
  ): Promise<LevantamentoItem[]> {
    const rows = await this.prisma.client.levantamento_itens.findMany({
      where: { levantamento_id: levantamentoId, deleted_at: null },
      include: { detecoes: true, evidencias: true },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => PrismaLevantamentoMapper.itemToDomain(r as any));
  }

  async findPlanejamento(id: string): Promise<PlanejamentoInfo | null> {
    const raw = await this.prisma.client.planejamento.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, ativo: true, cliente_id: true, tipo_entrada: true },
    });
    if (!raw) return null;
    return {
      id: raw.id,
      ativo: raw.ativo,
      clienteId: raw.cliente_id,
      tipoEntrada: raw.tipo_entrada,
    };
  }

  async findByPlanejamentoDataTipo(
    clienteId: string,
    planejamentoId: string,
    dataVoo: Date,
    tipoEntrada: string,
  ): Promise<Levantamento | null> {
    const raw = await this.prisma.client.levantamentos.findFirst({
      where: {
        cliente_id: clienteId,
        planejamento_id: planejamentoId,
        data_voo: dataVoo,
        tipo_entrada: tipoEntrada,
        deleted_at: null,
      },
    });
    return raw ? PrismaLevantamentoMapper.toDomain(raw as any) : null;
  }

  async findItemEvidencias(itemId: string): Promise<ItemEvidencia[]> {
    const rows = await this.prisma.client.levantamento_item_evidencias.findMany({
      where: { item_id: itemId },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      url: r.url,
      tipo: r.tipo ?? null,
      publicId: r.public_id ?? null,
      createdAt: r.created_at,
    }));
  }

  async findSlaConfig(clienteId: string): Promise<SlaConfigInfo | null> {
    const raw = await this.prisma.client.sla_config.findFirst({
      where: { cliente_id: clienteId },
      select: { config: true },
      orderBy: { created_at: 'desc' },
    });
    if (!raw) return null;
    return { config: raw.config as Record<string, unknown> };
  }

  private buildWhere(filters: FilterLevantamentoInput) {
    return {
      deleted_at: null,
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.planejamentoId && { planejamento_id: filters.planejamentoId }),
      ...(filters.cicloId && { ciclo_id: filters.cicloId }),
      ...(filters.usuarioId && { usuario_id: filters.usuarioId }),
      ...(filters.statusProcessamento && { status_processamento: filters.statusProcessamento }),
      ...(filters.tipoEntrada && { tipo_entrada: filters.tipoEntrada }),
    };
  }
}
