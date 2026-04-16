import {
  FilterPlanoAcaoAllInput,
  FilterPlanoAcaoInput,
} from '@modules/plano-acao/dtos/filter-plano-acao.input';
import { PlanoAcao } from '@modules/plano-acao/entities/plano-acao';
import { PlanoAcaoReadRepository } from '@modules/plano-acao/repositories/plano-acao-read.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaPlanoAcaoMapper } from '../../mappers/prisma-plano-acao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(PlanoAcaoReadRepository)
@Injectable()
export class PrismaPlanoAcaoReadRepository implements PlanoAcaoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId: string): Promise<PlanoAcao | null> {
    const raw = await this.prisma.client.plano_acao_catalogo.findFirst({
      where: { id, cliente_id: clienteId },
    });
    return raw ? PrismaPlanoAcaoMapper.toDomain(raw as any) : null;
  }

  async findAllActive(filters: FilterPlanoAcaoInput): Promise<PlanoAcao[]> {
    const rows = await this.prisma.client.plano_acao_catalogo.findMany({
      where: this.buildWhere(filters, true),
      orderBy: { ordem: 'asc' },
    });
    return rows.map((r) => PrismaPlanoAcaoMapper.toDomain(r as any));
  }

  async findAllIncludingInactive(
    filters: FilterPlanoAcaoAllInput,
  ): Promise<PlanoAcao[]> {
    const rows = await this.prisma.client.plano_acao_catalogo.findMany({
      where: this.buildWhereAll(filters),
      orderBy: { ordem: 'asc' },
    });
    return rows.map((r) => PrismaPlanoAcaoMapper.toDomain(r as any));
  }

  private buildWhere(filters: FilterPlanoAcaoInput, onlyActive: boolean) {
    return {
      ...(onlyActive && { ativo: true }),
      ...(filters.clienteId && { cliente_id: filters.clienteId }),
      ...(filters.tipoItem && { tipo_item: filters.tipoItem }),
    };
  }

  private buildWhereAll(filters: FilterPlanoAcaoAllInput) {
    return {
      ...(filters.clienteId && { cliente_id: filters.clienteId }),
      ...(filters.tipoItem && { tipo_item: filters.tipoItem }),
    };
  }
}
