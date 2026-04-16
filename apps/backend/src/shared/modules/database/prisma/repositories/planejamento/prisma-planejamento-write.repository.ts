import { Planejamento } from '@modules/planejamento/entities/planejamento';
import { PlanejamentoWriteRepository } from '@modules/planejamento/repositories/planejamento-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaPlanejamentoMapper } from '../../mappers/prisma-planejamento.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(PlanejamentoWriteRepository)
@Injectable()
export class PrismaPlanejamentoWriteRepository implements PlanejamentoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(entity: Planejamento): Promise<Planejamento> {
    const raw = await this.prisma.client.planejamento.create({
      data: PrismaPlanejamentoMapper.toPrisma(entity),
    });
    return PrismaPlanejamentoMapper.toDomain(raw as any);
  }

  async save(entity: Planejamento): Promise<void> {
    await this.prisma.client.planejamento.update({
      where: { id: entity.id },
      data: PrismaPlanejamentoMapper.toPrisma(entity),
    });
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.client.planejamento.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: deletedBy,
        updated_at: new Date(),
      },
    });
  }
}
