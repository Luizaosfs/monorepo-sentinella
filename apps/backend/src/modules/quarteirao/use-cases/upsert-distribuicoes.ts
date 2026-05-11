import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { UpsertDistribuicoesInput } from '../dtos/upsert-distribuicoes.body';
import { EnsureCicloEditavel } from './ensure-ciclo-editavel';
import { QuarteiraoException } from '../errors/quarteirao.exception';

@Injectable({ scope: Scope.REQUEST })
export class UpsertDistribuicoes {
  private readonly logger = new Logger(UpsertDistribuicoes.name);

  constructor(
    private prisma: PrismaService,
    private ensureCicloEditavel: EnsureCicloEditavel,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(clienteId: string, input: UpsertDistribuicoesInput): Promise<void> {
    if (input.rows.length === 0) return;

    const cicloId = input.rows[0].cicloId;
    await this.ensureCicloEditavel.execute(cicloId, clienteId);

    const usuarioId = (this.req['user'] as { id: string } | undefined)?.id ?? null;

    const ops = input.rows.map(row =>
      this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO bairros_distribuicao (cliente_id, ciclo_id, quadra_id, agente_id, bairro_id)
        VALUES (
          ${clienteId}::uuid,
          ${row.cicloId}::uuid,
          ${row.quadraId}::uuid,
          ${row.agenteId}::uuid,
          ${row.bairroId ?? null}::uuid
        )
        ON CONFLICT (cliente_id, ciclo_id, quadra_id)
        DO UPDATE SET
          agente_id  = EXCLUDED.agente_id,
          bairro_id  = EXCLUDED.bairro_id,
          updated_at = now()
      `),
    );

    try {
      await this.prisma.client.$transaction(ops);
    } catch (err) {
      this.logger.error(
        `UpsertDistribuicoes falhou — cliente=${clienteId} ciclo=${cicloId} rows=${input.rows.length}: ${String(err)}`,
      );
      throw QuarteiraoException.upsertDistribuicaoFailed();
    }

    // History — best-effort, non-blocking
    void Promise.allSettled(
      input.rows.map(row =>
        this.prisma.client.$executeRaw(Prisma.sql`
          INSERT INTO bairros_distribuicao_historico (cliente_id, ciclo_id, quadra_id, agente_id, acao, usuario_id)
          VALUES (${clienteId}::uuid, ${row.cicloId}::uuid, ${row.quadraId}::uuid, ${row.agenteId}::uuid, 'atribuida', ${usuarioId}::uuid)
        `)
      )
    );
  }
}
