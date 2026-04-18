import { FilterUsuarioInput } from '@modules/usuario/dtos/filter-usuario.input';
import { Usuario, UsuarioPaginated } from '@modules/usuario/entities/usuario';
import { UsuarioReadRepository } from '@modules/usuario/repositories/usuario-read.repository';
import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaUsuarioMapper } from '../../mappers/prisma-usuario.mapper';
import { PrismaService } from '../../prisma.service';

const INCLUDE_PAPEIS = { papeis_usuarios: true } as const;

@PrismaRepository(UsuarioReadRepository)
@Injectable()
export class PrismaUsuarioReadRepository implements UsuarioReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Usuario | null> {
    const raw = await this.prisma.client.usuarios.findUnique({
      where: { id },
      include: INCLUDE_PAPEIS,
    });
    return raw ? PrismaUsuarioMapper.toDomain(raw as any) : null;
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    const raw = await this.prisma.client.usuarios.findFirst({
      where: { email },
      include: INCLUDE_PAPEIS,
    });
    return raw ? PrismaUsuarioMapper.toDomain(raw as any) : null;
  }

  async findByClienteId(clienteId: string): Promise<Usuario[]> {
    const rows = await this.prisma.client.usuarios.findMany({
      where: { cliente_id: clienteId },
      include: INCLUDE_PAPEIS,
    });
    return rows.map((r) => PrismaUsuarioMapper.toDomain(r as any));
  }

  async findAll(filters: FilterUsuarioInput): Promise<Usuario[]> {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.client.usuarios.findMany({
      where,
      include: INCLUDE_PAPEIS,
      orderBy: { nome: 'asc' },
    });
    return rows.map((r) => PrismaUsuarioMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterUsuarioInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<UsuarioPaginated> {
    const where = this.buildWhere(filters);

    const [items, count] = await this.prisma.client.$transaction([
      this.prisma.client.usuarios.findMany({
        where,
        include: INCLUDE_PAPEIS,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey]: orderValue },
      }),
      this.prisma.client.usuarios.count({ where }),
    ]);

    const pagination = await Paginate(count, perPage, currentPage);

    return {
      items: items.map((r) => PrismaUsuarioMapper.toDomain(r as any)),
      pagination,
    };
  }

  async findPapeisCliente(clienteId: string | null): Promise<{ usuario_id: string; papel: string }[]> {
    const rows = await this.prisma.client.papeis_usuarios.findMany({
      where: clienteId != null ? { usuario: { cliente_id: clienteId } } : undefined,
      select: { usuario_id: true, papel: true },
    });
    return rows.map((r) => ({ usuario_id: r.usuario_id, papel: r.papel }));
  }

  private buildWhere(filters: FilterUsuarioInput) {
    return {
      ...(filters.nome && {
        nome: { contains: filters.nome, mode: 'insensitive' as const },
      }),
      ...(filters.email && {
        email: { contains: filters.email, mode: 'insensitive' as const },
      }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
      // MT-09: != null distingue null intencional (admin global) de UUID (tenant filter)
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.papel && {
        papeis_usuarios: { some: { papel: filters.papel } },
      }),
    };
  }
}
