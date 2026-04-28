import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class BuscarClientePorCidadePublico {
  constructor(private prisma: PrismaService) {}

  async execute(cidade: string): Promise<{ id: string; nome: string; cidade: string; uf: string; slug: string } | null> {
    const termo = `%${cidade.trim()}%`;
    const rows = await this.prisma.client.$queryRaw<
      { id: string; nome: string; cidade: string; uf: string; slug: string }[]
    >(
      Prisma.sql`
        SELECT id, nome, cidade, uf, slug
        FROM clientes
        WHERE deleted_at IS NULL
          AND ativo = true
          AND unaccent(lower(cidade)) LIKE unaccent(lower(${termo}))
        ORDER BY nome ASC
        LIMIT 1
      `,
    );
    return rows[0] ?? null;
  }
}
