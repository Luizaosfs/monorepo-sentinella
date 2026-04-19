import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { DeletarDistribuicoesInput } from '../dtos/deletar-distribuicoes.body';

@Injectable()
export class DeletarDistribuicoes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: DeletarDistribuicoesInput): Promise<{ deleted: number }> {
    if (input.quarteiroes.length === 0) return { deleted: 0 };
    const result = await this.prisma.client.distribuicao_quarteirao.deleteMany({
      where: {
        cliente_id: clienteId,
        ciclo:      input.ciclo,
        quarteirao: { in: input.quarteiroes },
      },
    });
    return { deleted: result.count };
  }
}
