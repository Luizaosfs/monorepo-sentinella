import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class RemoveAgrupamentoCliente {
  constructor(private prisma: PrismaService) {}

  async execute(agrupamentoId: string, clienteId: string): Promise<void> {
    await this.prisma.client.agrupamento_cliente.delete({
      where: {
        agrupamento_id_cliente_id: {
          agrupamento_id: agrupamentoId,
          cliente_id:     clienteId,
        },
      },
    });
  }
}
