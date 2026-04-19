import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListSynonyms {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    return this.prisma.client.sentinela_yolo_synonym.findMany({
      where:   { cliente_id: clienteId },
      orderBy: { synonym: 'asc' },
    });
  }
}
