import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class GetAnaliticoBairros {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista bairros distintos com vistorias.
   * @param clienteIds lista de clientes a considerar. null = sem filtro (admin escopo total).
   */
  async execute(clienteIds: string[] | null): Promise<string[]> {
    if (clienteIds !== null && clienteIds.length === 0) {
      return [];
    }

    const filtroClienteId =
      clienteIds === null
        ? Prisma.empty
        : Prisma.sql`AND v.cliente_id = ANY(ARRAY[${Prisma.join(
            clienteIds.map((id) => Prisma.sql`${id}::uuid`),
          )}]::uuid[])`;

    const rows = await this.prisma.client.$queryRaw<{ bairro: string }[]>(Prisma.sql`
      SELECT DISTINCT COALESCE(im.bairro, '(sem bairro)') AS bairro
      FROM vistorias v
      JOIN imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
      WHERE v.deleted_at IS NULL
        ${filtroClienteId}
      ORDER BY bairro
    `);
    return rows.map((r) => r.bairro);
  }
}
