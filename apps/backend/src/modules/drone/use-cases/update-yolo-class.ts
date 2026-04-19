import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { DroneException } from '../errors/drone.exception';
import { UpdateYoloClassInput } from '../dtos/drone-yolo.body';

@Injectable()
export class UpdateYoloClass {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, clienteId: string, input: UpdateYoloClassInput): Promise<void> {
    const existing = await this.prisma.client.sentinela_yolo_class_config.findFirst({
      where:  { id },
      select: { id: true, cliente_id: true },
    });
    if (!existing) throw DroneException.yoloClassNotFound();
    if (existing.cliente_id !== clienteId) throw DroneException.forbidden();

    await this.prisma.client.sentinela_yolo_class_config.update({
      where: { id },
      data: {
        ...(input.item     != null && { item:      input.item }),
        ...(input.risco    != null && { risco:     input.risco }),
        ...(input.peso     != null && { peso:      input.peso }),
        ...(input.acao     !== undefined && { acao: input.acao }),
        ...(input.isActive != null && { is_active: input.isActive }),
        updated_at: new Date(),
      },
    });
  }
}
