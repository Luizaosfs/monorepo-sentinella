import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListAgrupamentoClientes {
  constructor(private prisma: PrismaService) {}

  async execute(agrupamentoId: string) {
    const rows = await this.prisma.client.agrupamento_cliente.findMany({
      where: { agrupamento_id: agrupamentoId },
      select: { cliente_id: true },
    });

    const ids = rows.map(r => r.cliente_id);
    if (ids.length === 0) return [];

    return this.prisma.client.clientes.findMany({
      where: { id: { in: ids }, deleted_at: null },
      select: { id: true, nome: true, cidade: true, uf: true },
    });
  }
}
