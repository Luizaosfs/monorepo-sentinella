import { FilterRegiaoInput } from '@modules/regiao/dtos/filter-regiao.input';
import { Regiao, RegiaoPaginated } from '@modules/regiao/entities/regiao';
import { RegiaoReadRepository } from '@modules/regiao/repositories/regiao-read.repository';
import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaRegiaoMapper } from '../../mappers/prisma-regiao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(RegiaoReadRepository)
@Injectable()
export class PrismaRegiaoReadRepository implements RegiaoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId: string | null): Promise<Regiao | null> {
    const raw = await this.prisma.client.regioes.findFirst({
      where: { id, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaRegiaoMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterRegiaoInput): Promise<Regiao[]> {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.client.regioes.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
    return rows.map((r) => PrismaRegiaoMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterRegiaoInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<RegiaoPaginated> {
    const where = this.buildWhere(filters);
    const [items, count] = await this.prisma.client.$transaction([
      this.prisma.client.regioes.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey]: orderValue },
      }),
      this.prisma.client.regioes.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: items.map((r) => PrismaRegiaoMapper.toDomain(r as any)),
      pagination,
    };
  }

  private buildWhere(filters: FilterRegiaoInput) {
    return {
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.nome && {
        nome: { contains: filters.nome, mode: 'insensitive' as const },
      }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
    };
  }
}
