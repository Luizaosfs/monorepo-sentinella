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

  async findById(id: string): Promise<Reinspecao | null> {
    const raw = await this.prisma.client.reinspecoes_programadas.findUnique({
      where: { id },
    });
    return raw ? PrismaReinspecaoMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterReinspecaoInput): Promise<Reinspecao[]> {
    const rows = await this.prisma.client.reinspecoes_programadas.findMany({
      where: {
        ...(filters.clienteId && { cliente_id: filters.clienteId }),
        ...(filters.focoRiscoId && { foco_risco_id: filters.focoRiscoId }),
        ...(filters.status && { status: filters.status }),
      },
      orderBy: [{ data_prevista: 'asc' }, { created_at: 'desc' }],
    });
    return rows.map((r) => PrismaReinspecaoMapper.toDomain(r as any));
  }
}
