import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ConsultarDenuncia {
  constructor(private prisma: PrismaService) {}

  async execute(protocolo: string): Promise<unknown> {
    const rows = await this.prisma.client.$queryRaw<unknown[]>(
      Prisma.sql`SELECT * FROM consultar_denuncia_cidadao(${protocolo})`,
    );
    return rows[0] ?? null;
  }
}
