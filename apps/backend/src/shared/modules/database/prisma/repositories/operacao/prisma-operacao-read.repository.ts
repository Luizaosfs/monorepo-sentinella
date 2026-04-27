import { FilterOperacaoInput } from '@modules/operacao/dtos/filter-operacao.input';
import {
  Operacao,
  OperacaoPaginated,
} from '@modules/operacao/entities/operacao';
import { OperacaoReadRepository } from '@modules/operacao/repositories/operacao-read.repository';
import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaOperacaoMapper } from '../../mappers/prisma-operacao.mapper';
import { PrismaService } from '../../prisma.service';

const INCLUDE_EVIDENCIAS = { evidencias: true } as const;

@PrismaRepository(OperacaoReadRepository)
@Injectable()
export class PrismaOperacaoReadRepository implements OperacaoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId: string | null): Promise<Operacao | null> {
    const raw = await this.prisma.client.operacoes.findFirst({
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaOperacaoMapper.toDomain(raw as any) : null;
  }

  async findByIdComEvidencias(id: string, clienteId: string | null): Promise<Operacao | null> {
    const raw = await this.prisma.client.operacoes.findFirst({
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
      include: INCLUDE_EVIDENCIAS,
    });
    return raw ? PrismaOperacaoMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterOperacaoInput): Promise<Operacao[]> {
    const rows = await this.prisma.client.operacoes.findMany({
      where: this.buildWhere(filters),
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => PrismaOperacaoMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterOperacaoInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<OperacaoPaginated> {
    const where = this.buildWhere(filters);
    const [rows, count] = await this.prisma.client.$transaction([
      this.prisma.client.operacoes.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey ?? 'created_at']: orderValue ?? 'desc' },
      }),
      this.prisma.client.operacoes.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: rows.map((r) => PrismaOperacaoMapper.toDomain(r as any)),
      pagination,
    };
  }

  async findAtivaParaItem(
    clienteId: string,
    itemLevantamentoId: string,
  ): Promise<Operacao | null> {
    const raw = await this.prisma.client.operacoes.findFirst({
      where: {
        cliente_id: clienteId,
        item_levantamento_id: itemLevantamentoId,
        status: { in: ['pendente', 'em_andamento'] },
        deleted_at: null,
      },
    });
    return raw ? PrismaOperacaoMapper.toDomain(raw as any) : null;
  }

  async countByStatus(clienteId: string): Promise<Record<string, number>> {
    const groups = await this.prisma.client.operacoes.groupBy({
      by: ['status'],
      where: { cliente_id: clienteId, deleted_at: null },
      _count: { status: true },
    });
    return Object.fromEntries(groups.map((g) => [g.status, g._count.status]));
  }

  private buildWhere(filters: FilterOperacaoInput) {
    return {
      deleted_at: null,
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.prioridade && { prioridade: filters.prioridade }),
      ...(filters.responsavelId && { responsavel_id: filters.responsavelId }),
      ...(filters.tipoVinculo && { tipo_vinculo: filters.tipoVinculo }),
      ...(filters.focoRiscoId && { foco_risco_id: filters.focoRiscoId }),
    };
  }
}
