import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { ListCasosPaginadoInput } from '../dtos/casos-cruzamentos.body';

@Injectable()
export class ListarCasosPaginado {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: ListCasosPaginadoInput) {
    const limit = input.limit ?? 20;

    const rows = input.cursorCreated && input.cursorId
      ? await this.prisma.client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          SELECT id, doenca, status, data_notificacao,
                 logradouro_bairro, bairro, latitude, longitude,
                 regiao_id, observacao, created_at
          FROM casos_notificados
          WHERE cliente_id = ${clienteId}::uuid
            AND deleted_at IS NULL
            AND (created_at, id) < (${new Date(input.cursorCreated)}::timestamptz, ${input.cursorId}::uuid)
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit + 1}
        `)
      : await this.prisma.client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          SELECT id, doenca, status, data_notificacao,
                 logradouro_bairro, bairro, latitude, longitude,
                 regiao_id, observacao, created_at
          FROM casos_notificados
          WHERE cliente_id = ${clienteId}::uuid
            AND deleted_at IS NULL
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit + 1}
        `);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1] as { created_at: Date; id: string } | undefined;

    return {
      data,
      nextCursor: hasMore && last
        ? { created_at: last.created_at, id: last.id }
        : null,
    };
  }
}
