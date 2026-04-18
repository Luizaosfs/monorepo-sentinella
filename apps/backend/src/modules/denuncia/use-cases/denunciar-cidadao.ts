import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { DenunciaCidadaoBody } from '../dtos/denuncia-cidadao.body';

@Injectable()
export class DenunciarCidadao {
  constructor(private prisma: PrismaService) {}

  async execute(input: DenunciaCidadaoBody, authId?: string): Promise<{ protocolo: string; id: string }> {
    const rows = await this.prisma.client.$queryRaw<Array<{ protocolo: string; id: string }>>(
      Prisma.sql`
        SELECT * FROM denunciar_cidadao(
          ${input.slug},
          ${input.bairroId ?? null}::uuid,
          ${input.descricao},
          ${input.latitude ?? null}::float8,
          ${input.longitude ?? null}::float8,
          ${input.fotoUrl ?? null},
          ${input.fotoPublicId ?? null},
          ${authId ?? null}::uuid
        )
      `,
    );
    return rows[0];
  }
}
