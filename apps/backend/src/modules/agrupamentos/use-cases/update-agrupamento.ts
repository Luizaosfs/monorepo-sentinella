import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { z } from 'zod';
import { updateAgrupamentoSchema } from '../dtos/agrupamentos.body';

type Input = z.infer<typeof updateAgrupamentoSchema>;

@Injectable()
export class UpdateAgrupamento {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, input: Input) {
    const existing = await this.prisma.client.agrupamento_regional.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Agrupamento não encontrado');

    return this.prisma.client.agrupamento_regional.update({
      where: { id },
      data: {
        ...(input.nome  !== undefined && { nome:  input.nome }),
        ...(input.tipo  !== undefined && { tipo:  input.tipo }),
        ...(input.uf    !== undefined && { uf:    input.uf }),
        ...(input.ativo !== undefined && { ativo: input.ativo }),
        updated_at: new Date(),
      },
    });
  }
}
