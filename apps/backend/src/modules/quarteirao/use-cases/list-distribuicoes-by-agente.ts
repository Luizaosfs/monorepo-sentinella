import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListDistribuicoesByAgente {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, agenteId: string, ciclo: number): Promise<string[]> {
    const rows = await this.prisma.client.distribuicao_quarteirao.findMany({
      where: { cliente_id: clienteId, agente_id: agenteId, ciclo },
      select: { quarteirao: true },
    });
    return rows.map(r => r.quarteirao);
  }
}
