import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ItemStatusesByCliente {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.client.operacoes.findMany({
      where: {
        cliente_id:            clienteId,
        item_levantamento_id:  { not: null },
        deleted_at:            null,
      },
      select: { item_levantamento_id: true, status: true },
    });

    const statusMap: Record<string, string> = {};
    for (const op of rows) {
      if (!op.item_levantamento_id) continue;
      const existing = statusMap[op.item_levantamento_id];
      if (
        !existing ||
        op.status === 'concluido' ||
        (op.status === 'em_andamento' && existing !== 'concluido')
      ) {
        statusMap[op.item_levantamento_id] = op.status;
      }
    }
    return statusMap;
  }
}
