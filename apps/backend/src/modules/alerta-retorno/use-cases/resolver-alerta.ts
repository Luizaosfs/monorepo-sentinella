import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ResolverAlerta {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, clienteId: string) {
    const result = await this.prisma.client.alerta_retorno_imovel.updateMany({
      where: { id, cliente_id: clienteId },
      data: { resolvido: true, resolvido_em: new Date() },
    });

    if (result.count === 0) {
      throw new NotFoundException('Alerta não encontrado');
    }

    return { resolved: true };
  }
}
