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

  private resolveClient(tx?: unknown) {
    return (tx ?? this.prisma.client) as any;
  }

  async create(entity: Reinspecao): Promise<Reinspecao> {
    const data = PrismaReinspecaoMapper.toPrismaCreate(entity);
    const created = await this.prisma.client.reinspecoes_programadas.create({
      data,
    });
    return PrismaReinspecaoMapper.toDomain(created as any);
  }

  async createWithTx(entity: Reinspecao, tx?: unknown): Promise<Reinspecao> {
    const client = this.resolveClient(tx);
    const data = PrismaReinspecaoMapper.toPrismaCreate(entity);
    const created = await client.reinspecoes_programadas.create({ data });
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

  async cancelarPendentesPorFoco(
    focoRiscoId: string,
    motivo: string,
    canceladoPor?: string,
    tx?: unknown,
  ): Promise<number> {
    const client = this.resolveClient(tx);
    const result = await client.reinspecoes_programadas.updateMany({
      where: {
        foco_risco_id: focoRiscoId,
        status: 'pendente',
      },
      data: {
        status: 'cancelada',
        motivo_cancelamento: motivo,
        cancelado_por: canceladoPor ?? null,
        updated_at: new Date(),
      },
    });
    return result.count;
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
