import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { DroneException } from '../errors/drone.exception';

@Injectable()
export class DeleteSynonym {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, clienteId: string): Promise<void> {
    const existing = await this.prisma.client.sentinela_yolo_synonym.findFirst({
      where:  { id },
      select: { id: true, cliente_id: true },
    });
    if (!existing) throw DroneException.synonymNotFound();
    if (existing.cliente_id !== clienteId) throw DroneException.forbidden();

    await this.prisma.client.sentinela_yolo_synonym.delete({ where: { id } });
  }
}
