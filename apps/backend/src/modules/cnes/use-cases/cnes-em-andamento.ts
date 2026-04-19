import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class CnesEmAndamento {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<{ em_andamento: boolean; controle?: unknown }> {
    const controle = await this.prisma.client.unidades_saude_sync_controle.findFirst({
      where: { cliente_id: clienteId, status: 'em_andamento' },
      orderBy: [{ iniciado_em: 'desc' }],
    });
    return { em_andamento: !!controle, controle: controle ?? undefined };
  }
}
