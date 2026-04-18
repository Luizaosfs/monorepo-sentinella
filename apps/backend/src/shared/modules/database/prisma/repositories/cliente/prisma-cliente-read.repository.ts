import { FilterClienteInput } from '@modules/cliente/dtos/filter-cliente.input';
import { Cliente, ClientePaginated } from '@modules/cliente/entities/cliente';
import {
  ClienteIntegracaoApiKey,
  ClienteReadRepository,
} from '@modules/cliente/repositories/cliente-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaClienteMapper } from '../../mappers/prisma-cliente.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ClienteReadRepository)
@Injectable()
export class PrismaClienteReadRepository implements ClienteReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Cliente | null> {
    const raw = await this.prisma.client.clientes.findUnique({
      where: { id, deleted_at: null },
    });
    return raw ? PrismaClienteMapper.toDomain(raw as any) : null;
  }

  async findBySlug(slug: string): Promise<Cliente | null> {
    const raw = await this.prisma.client.clientes.findFirst({
      where: { slug, deleted_at: null },
    });
    return raw ? PrismaClienteMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterClienteInput): Promise<Cliente[]> {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.client.clientes.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
    return rows.map((r) => PrismaClienteMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterClienteInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<ClientePaginated> {
    const where = this.buildWhere(filters);

    const [items, count] = await this.prisma.client.$transaction([
      this.prisma.client.clientes.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey]: orderValue },
      }),
      this.prisma.client.clientes.count({ where }),
    ]);

    const pagination = await Paginate(count, perPage, currentPage);

    return {
      items: items.map((r) => PrismaClienteMapper.toDomain(r as any)),
      pagination,
    };
  }

  async findPorCoordenada(lat: number, lng: number): Promise<Cliente | null> {
    const rows = await this.prisma.client.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM clientes
        WHERE deleted_at IS NULL
          AND bounds IS NOT NULL
          AND (bounds->>'south')::float <= ${lat}
          AND (bounds->>'north')::float >= ${lat}
          AND (bounds->>'west')::float  <= ${lng}
          AND (bounds->>'east')::float  >= ${lng}
        LIMIT 1
      `,
    );
    if (!rows.length) return null;
    return this.findById(rows[0].id);
  }

  async findIntegracaoApiKey(id: string): Promise<ClienteIntegracaoApiKey | null> {
    const raw = await this.prisma.client.cliente_integracoes.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return {
      id: raw.id,
      clienteId: raw.cliente_id,
      tipo: raw.tipo,
      apiKey: raw.api_key,
      apiKeyMasked: raw.api_key_masked ?? null,
      ativo: raw.ativo,
      ambiente: raw.ambiente,
    };
  }

  private buildWhere(filters: FilterClienteInput) {
    return {
      deleted_at: null,
      ...(filters.nome && {
        nome: { contains: filters.nome, mode: 'insensitive' as const },
      }),
      ...(filters.slug && {
        slug: { contains: filters.slug, mode: 'insensitive' as const },
      }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
      ...(filters.uf && { uf: filters.uf }),
      ...(filters.ibgeMunicipio && { ibge_municipio: filters.ibgeMunicipio }),
      ...(filters.cidade && {
        cidade: { contains: filters.cidade, mode: 'insensitive' as const },
      }),
    };
  }
}
