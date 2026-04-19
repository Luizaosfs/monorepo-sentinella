import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListarLogCnes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, controleId?: string) {
    return this.prisma.client.unidades_saude_sync_log.findMany({
      where: {
        cliente_id: clienteId,
        ...(controleId && { controle_id: controleId }),
      },
      orderBy: [{ created_at: 'desc' }],
      take: 100,
    });
  }
}
