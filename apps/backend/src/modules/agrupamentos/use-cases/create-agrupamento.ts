import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { z } from 'zod';
import { createAgrupamentoSchema } from '../dtos/agrupamentos.body';

type Input = z.infer<typeof createAgrupamentoSchema>;

@Injectable()
export class CreateAgrupamento {
  constructor(private prisma: PrismaService) {}

  async execute(input: Input) {
    return this.prisma.client.agrupamento_regional.create({
      data: {
        nome: input.nome,
        tipo: input.tipo,
        uf:   input.uf ?? null,
      },
    });
  }
}
