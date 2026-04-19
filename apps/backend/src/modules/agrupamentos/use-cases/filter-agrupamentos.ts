import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class FilterAgrupamentos {
  constructor(private prisma: PrismaService) {}

  async execute() {
    return this.prisma.client.agrupamento_regional.findMany({
      where: { ativo: true },
      orderBy: [{ nome: 'asc' }],
    });
  }
}
