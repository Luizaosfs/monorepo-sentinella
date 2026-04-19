import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListSnapshots {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    return this.prisma.client.billing_usage_snapshot.findMany({
      where: { cliente_id: clienteId },
      orderBy: [{ periodo_inicio: 'desc' }],
      take: 12,
    });
  }
}
