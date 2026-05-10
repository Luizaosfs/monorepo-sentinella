import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { DeletarDistribuicoesInput } from '../dtos/deletar-distribuicoes.body';
import { EnsureCicloEditavel } from './ensure-ciclo-editavel';

@Injectable({ scope: Scope.REQUEST })
export class DeletarDistribuicoes {
  constructor(
    private prisma: PrismaService,
    private ensureCicloEditavel: EnsureCicloEditavel,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(clienteId: string, input: DeletarDistribuicoesInput): Promise<{ deleted: number }> {
    if (input.quadraIds.length === 0) return { deleted: 0 };

    await this.ensureCicloEditavel.execute(input.cicloId, clienteId);

    const usuarioId = (this.req['user'] as { id: string } | undefined)?.id ?? null;

    // Fetch current assignments before deletion (for history)
    const rows = await this.prisma.client.bairros_distribuicao.findMany({
      where: {
        cliente_id: clienteId,
        ciclo_id:   input.cicloId,
        quadra_id:  { in: input.quadraIds },
      },
      select: { quadra_id: true, agente_id: true },
    });

    const result = await this.prisma.client.bairros_distribuicao.deleteMany({
      where: {
        cliente_id: clienteId,
        ciclo_id:   input.cicloId,
        quadra_id:  { in: input.quadraIds },
      },
    });

    // History — best-effort, non-blocking
    if (rows.length > 0) {
      void Promise.allSettled(
        rows.map(row =>
          this.prisma.client.$executeRaw(Prisma.sql`
            INSERT INTO bairros_distribuicao_historico (cliente_id, ciclo_id, quadra_id, agente_id, acao, usuario_id)
            VALUES (${clienteId}::uuid, ${input.cicloId}::uuid, ${row.quadra_id}::uuid, ${row.agente_id}::uuid, 'excluida', ${usuarioId}::uuid)
          `)
        )
      );
    }

    return { deleted: result.count };
  }
}
