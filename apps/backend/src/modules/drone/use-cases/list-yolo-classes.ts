import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListYoloClasses {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    return this.prisma.client.sentinela_yolo_class_config.findMany({
      where:   { cliente_id: clienteId },
      orderBy: { item_key: 'asc' },
    });
  }
}
