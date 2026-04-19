import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListarControleCnes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    return this.prisma.client.unidades_saude_sync_controle.findMany({
      where: { cliente_id: clienteId },
      orderBy: [{ iniciado_em: 'desc' }],
      take: 20,
    });
  }
}
