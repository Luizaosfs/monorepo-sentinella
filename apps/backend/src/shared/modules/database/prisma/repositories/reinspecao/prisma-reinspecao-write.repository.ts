import { Reinspecao } from '@modules/reinspecao/entities/reinspecao';
import { ReinspecaoWriteRepository } from '@modules/reinspecao/repositories/reinspecao-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaReinspecaoMapper } from '../../mappers/prisma-reinspecao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ReinspecaoWriteRepository)
@Injectable()
export class PrismaReinspecaoWriteRepository implements ReinspecaoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(entity: Reinspecao): Promise<Reinspecao> {
    const data = PrismaReinspecaoMapper.toPrismaCreate(entity);
    const created = await this.prisma.client.reinspecoes_programadas.create({
      data,
    });
    return PrismaReinspecaoMapper.toDomain(created as any);
  }

  async save(entity: Reinspecao): Promise<void> {
    if (!entity.id) return;
    const data = PrismaReinspecaoMapper.toPrismaUpdate(entity);
    await this.prisma.client.reinspecoes_programadas.update({
      where: { id: entity.id },
      data,
    });
  }

  async marcarPendentesVencidas(): Promise<{ atualizadas: number }> {
    const now = new Date();
    const result = await this.prisma.client.reinspecoes_programadas.updateMany(
      {
        where: {
          status: 'pendente',
          data_prevista: { lt: now },
        },
        data: {
          status: 'vencida',
          updated_at: now,
        },
      },
    );
    return { atualizadas: result.count };
  }
}
