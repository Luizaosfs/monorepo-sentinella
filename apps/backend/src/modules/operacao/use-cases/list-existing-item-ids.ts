import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListExistingItemIds {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, itemIds: string[]): Promise<string[]> {
    if (itemIds.length === 0) return [];

    const rows = await this.prisma.client.operacoes.findMany({
      where: {
        cliente_id:           clienteId,
        status:               { in: ['pendente', 'em_andamento'] },
        item_operacional_id:  { in: itemIds },
        deleted_at:           null,
      },
      select: { item_operacional_id: true },
    });

    return rows
      .map(r => r.item_operacional_id)
      .filter((id): id is string => id !== null);
  }
}
