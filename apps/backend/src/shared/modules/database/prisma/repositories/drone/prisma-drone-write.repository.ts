import { Injectable } from '@nestjs/common';
import {
  Drone,
  Voo,
  YoloFeedback,
} from 'src/modules/drone/entities/drone';
import { DroneWriteRepository } from 'src/modules/drone/repositories/drone-write.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaDroneMapper } from '../../mappers/prisma-drone.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(DroneWriteRepository)
@Injectable()
export class PrismaDroneWriteRepository implements DroneWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createDrone(entity: Drone): Promise<Drone> {
    const row = await this.prisma.client.drones.create({
      data: PrismaDroneMapper.toPrisma(entity),
    });
    return PrismaDroneMapper.toDomain(row as any);
  }

  async saveDrone(entity: Drone): Promise<void> {
    await this.prisma.client.drones.update({
      where: { id: entity.id },
      data: PrismaDroneMapper.toPrisma(entity),
    });
  }

  async deleteDrone(id: string): Promise<void> {
    await this.prisma.client.drones.update({
      where: { id },
      data: { ativo: false, updated_at: new Date() },
    });
  }

  async createVoo(entity: Voo): Promise<Voo> {
    const row = await this.prisma.client.voos.create({
      data: PrismaDroneMapper.vooToPrisma(entity) as any,
    });
    return PrismaDroneMapper.vooToDomain(row as any);
  }

  async saveVoo(entity: Voo): Promise<void> {
    await this.prisma.client.voos.update({
      where: { id: entity.id },
      data: PrismaDroneMapper.vooToPrisma(entity) as any,
    });
  }

  async deleteVoo(id: string): Promise<void> {
    await this.prisma.client.voos.delete({ where: { id } });
  }

  async createYoloFeedback(entity: YoloFeedback): Promise<YoloFeedback> {
    const row = await this.prisma.client.yolo_feedback.create({
      data: {
        levantamento_item_id: entity.levantamentoItemId,
        cliente_id: entity.clienteId,
        confirmado: entity.confirmado,
        observacao: entity.observacao ?? null,
        registrado_por: entity.registradoPor ?? null,
      },
    });
    return PrismaDroneMapper.feedbackToDomain(row as any);
  }
}
