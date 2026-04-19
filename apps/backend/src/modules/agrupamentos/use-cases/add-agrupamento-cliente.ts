import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class AddAgrupamentoCliente {
  constructor(private prisma: PrismaService) {}

  async execute(agrupamentoId: string, clienteId: string) {
    return this.prisma.client.agrupamento_cliente.create({
      data: {
        agrupamento_id: agrupamentoId,
        cliente_id:     clienteId,
      },
    });
  }
}
