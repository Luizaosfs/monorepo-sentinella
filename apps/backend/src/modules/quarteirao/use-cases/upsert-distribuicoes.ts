import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { UpsertDistribuicoesInput } from '../dtos/upsert-distribuicoes.body';

@Injectable()
export class UpsertDistribuicoes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: UpsertDistribuicoesInput): Promise<void> {
    if (input.rows.length === 0) return;
    const ops = input.rows.map(row =>
      this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO distribuicao_quarteirao (cliente_id, ciclo, quarteirao, agente_id, regiao_id)
        VALUES (
          ${clienteId}::uuid,
          ${row.ciclo},
          ${row.quarteirao},
          ${row.agenteId}::uuid,
          ${row.regiaoId ?? null}::uuid
        )
        ON CONFLICT (cliente_id, ciclo, quarteirao)
        DO UPDATE SET
          agente_id = EXCLUDED.agente_id,
          regiao_id = EXCLUDED.regiao_id,
          updated_at = now()
      `),
    );
    await this.prisma.client.$transaction(ops);
  }
}
