import { FilterReinspecaoInput } from '@modules/reinspecao/dtos/filter-reinspecao.input';
import { Reinspecao } from '@modules/reinspecao/entities/reinspecao';
import { ReinspecaoReadRepository } from '@modules/reinspecao/repositories/reinspecao-read.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaReinspecaoMapper } from '../../mappers/prisma-reinspecao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ReinspecaoReadRepository)
@Injectable()
export class PrismaReinspecaoReadRepository implements ReinspecaoReadRepository {
  constructor(private prisma: PrismaService) {}

  private resolveClient(tx?: unknown) {
    return (tx ?? this.prisma.client) as any;
  }

  async findPendenteByFocoETipo(
    focoRiscoId: string,
    tipo: string,
    tx?: unknown,
  ): Promise<Reinspecao | null> {
    const client = this.resolveClient(tx);
    const raw = await client.reinspecoes_programadas.findFirst({
      where: {
        foco_risco_id: focoRiscoId,
        tipo,
        status: 'pendente',
      },
      orderBy: { created_at: 'desc' },
    });
    return raw ? PrismaReinspecaoMapper.toDomain(raw) : null;
  }

  async findById(id: string, clienteId?: string | null): Promise<Reinspecao | null> {
    // MT-06: findUnique não aceita cliente_id junto; usa findFirst para filtrar por tenant
    const raw = await this.prisma.client.reinspecoes_programadas.findFirst({
      where: { id, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaReinspecaoMapper.toDomain(raw) : null;
  }

  async findAll(filters: FilterReinspecaoInput): Promise<Reinspecao[]> {
    const rows = await this.prisma.client.reinspecoes_programadas.findMany({
      where: this.buildWhere(filters),
      orderBy: [{ data_prevista: 'asc' }, { created_at: 'desc' }],
    });
    return rows.map((r) => PrismaReinspecaoMapper.toDomain(r));
  }

  private buildWhere(filters: FilterReinspecaoInput) {
    return {
      // != null distingue null intencional (admin global) de UUID (tenant filter).
      // undefined também passa sem filtro — controlado pelo TenantGuard + MT-02/03/04.
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.focoRiscoId && { foco_risco_id: filters.focoRiscoId }),
      ...(filters.agenteId && { responsavel_id: filters.agenteId }),
      ...(filters.status?.length && {
        status: filters.status.length === 1 ? filters.status[0] : { in: filters.status },
      }),
    };
  }

  async countPendentes(clienteId: string, agenteId?: string): Promise<number> {
    return this.prisma.client.reinspecoes_programadas.count({
      where: {
        cliente_id: clienteId,
        ...(agenteId && { responsavel_id: agenteId }),
        status: { in: ['pendente', 'vencida'] },
      },
    });
  }
}
