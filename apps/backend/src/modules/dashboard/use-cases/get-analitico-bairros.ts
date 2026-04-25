import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class GetAnaliticoBairros {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<string[]> {
    const rows = await this.prisma.client.$queryRaw<{ bairro: string }[]>(Prisma.sql`
      SELECT DISTINCT COALESCE(im.bairro, '(sem bairro)') AS bairro
      FROM vistorias v
      JOIN imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
      WHERE v.deleted_at IS NULL
        AND v.cliente_id = ${clienteId}::uuid
      ORDER BY bairro
    `);
    return rows.map((r) => r.bairro);
  }
}
