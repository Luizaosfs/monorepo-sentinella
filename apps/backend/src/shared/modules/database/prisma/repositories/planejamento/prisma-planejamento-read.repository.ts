import { FilterPlanejamentoInput } from '@modules/planejamento/dtos/filter-planejamento.input';
import { Planejamento } from '@modules/planejamento/entities/planejamento';
import { PlanejamentoReadRepository } from '@modules/planejamento/repositories/planejamento-read.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaPlanejamentoMapper } from '../../mappers/prisma-planejamento.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(PlanejamentoReadRepository)
@Injectable()
export class PrismaPlanejamentoReadRepository implements PlanejamentoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId: string | null): Promise<Planejamento | null> {
    const raw = await this.prisma.client.planejamento.findFirst({
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaPlanejamentoMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterPlanejamentoInput): Promise<Planejamento[]> {
    const rows = await this.prisma.client.planejamento.findMany({
      where: this.buildWhere(filters),
      orderBy: { data_planejamento: 'desc' },
    });
    return rows.map((r) => PrismaPlanejamentoMapper.toDomain(r as any));
  }

  async findAtivos(clienteId: string): Promise<Planejamento[]> {
    const rows = await this.prisma.client.planejamento.findMany({
      where: { cliente_id: clienteId, ativo: true, deleted_at: null },
      orderBy: { data_planejamento: 'desc' },
    });
    return rows.map((r) => PrismaPlanejamentoMapper.toDomain(r as any));
  }

  async findAtivosManuais(clienteId: string): Promise<Planejamento[]> {
    const rows = await this.prisma.client.planejamento.findMany({
      where: {
        cliente_id: clienteId,
        ativo: true,
        deleted_at: null,
        OR: [{ tipo_levantamento: 'MANUAL' }, { tipo_entrada: 'MANUAL' }],
      },
      orderBy: { data_planejamento: 'desc' },
    });
    return rows.map((r) => PrismaPlanejamentoMapper.toDomain(r as any));
  }

  private buildWhere(filters: FilterPlanejamentoInput) {
    return {
      deleted_at: null,
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
      ...(filters.tipoLevantamento && {
        tipo_levantamento: filters.tipoLevantamento,
      }),
      ...(filters.regiaoId && { regiao_id: filters.regiaoId }),
    };
  }
}
