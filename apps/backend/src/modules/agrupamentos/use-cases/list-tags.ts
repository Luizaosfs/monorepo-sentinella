import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListTags {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId?: string) {
    return this.prisma.client.tags.findMany({
      where: clienteId
        ? { OR: [{ cliente_id: clienteId }, { cliente_id: null }] }
        : {},
      orderBy: [{ slug: 'asc' }],
    });
  }
}
