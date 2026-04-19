import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListYoloClassConfig {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const items = await this.prisma.client.sentinela_yolo_class_config.findMany({
      where:   { cliente_id: clienteId, is_active: true },
      orderBy: { item_key: 'asc' },
    });
    return items;
  }
}
