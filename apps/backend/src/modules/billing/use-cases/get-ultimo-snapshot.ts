import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class GetUltimoSnapshot {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    return this.prisma.client.billing_usage_snapshot.findFirst({
      where: { cliente_id: clienteId },
      orderBy: [{ periodo_inicio: 'desc' }],
    });
  }
}
