import { FilterVistoriaInput } from '@modules/vistoria/dtos/filter-vistoria.input';
import {
  Vistoria,
  VistoriaPaginated,
} from '@modules/vistoria/entities/vistoria';
import { VistoriaReadRepository } from '@modules/vistoria/repositories/vistoria-read.repository';
import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaVistoriaMapper } from '../../mappers/prisma-vistoria.mapper';
import { PrismaService } from '../../prisma.service';

const INCLUDE_DETALHES = {
  depositos: true,
  sintomas: true,
  riscos: true,
  calhas: true,
} as const;

@PrismaRepository(VistoriaReadRepository)
@Injectable()
export class PrismaVistoriaReadRepository implements VistoriaReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Vistoria | null> {
    const raw = await this.prisma.client.vistorias.findUnique({
      where: { id },
    });
    return raw ? PrismaVistoriaMapper.toDomain(raw as any) : null;
  }

  async findByIdComDetalhes(id: string): Promise<Vistoria | null> {
    const raw = await this.prisma.client.vistorias.findUnique({
      where: { id },
      include: INCLUDE_DETALHES,
    });
    return raw ? PrismaVistoriaMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterVistoriaInput): Promise<Vistoria[]> {
    const rows = await this.prisma.client.vistorias.findMany({
      where: this.buildWhere(filters),
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => PrismaVistoriaMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterVistoriaInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<VistoriaPaginated> {
    const where = this.buildWhere(filters);
    const [rows, count] = await this.prisma.client.$transaction([
      this.prisma.client.vistorias.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey ?? 'created_at']: orderValue ?? 'desc' },
      }),
      this.prisma.client.vistorias.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: rows.map((r) => PrismaVistoriaMapper.toDomain(r as any)),
      pagination,
    };
  }

  private buildWhere(filters: FilterVistoriaInput) {
    return {
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.imovelId && { imovel_id: filters.imovelId }),
      ...(filters.agenteId && { agente_id: filters.agenteId }),
      ...(filters.planejamentoId && {
        planejamento_id: filters.planejamentoId,
      }),
      ...(filters.ciclo && { ciclo: filters.ciclo }),
      ...(filters.tipoAtividade && { tipo_atividade: filters.tipoAtividade }),
      ...(filters.status && { status: filters.status }),
      ...(filters.focoRiscoId && { foco_risco_id: filters.focoRiscoId }),
      ...((filters.dataInicio || filters.dataFim) && {
        data_visita: {
          ...(filters.dataInicio && { gte: filters.dataInicio }),
          ...(filters.dataFim && { lte: filters.dataFim }),
        },
      }),
      ...(filters.createdAfter && { created_at: { gte: filters.createdAfter } }),
      ...(filters.acessoRealizado !== undefined && {
        acesso_realizado: filters.acessoRealizado,
      }),
    };
  }

  async count(filters: FilterVistoriaInput): Promise<number> {
    return this.prisma.client.vistorias.count({ where: this.buildWhere(filters) });
  }
}
