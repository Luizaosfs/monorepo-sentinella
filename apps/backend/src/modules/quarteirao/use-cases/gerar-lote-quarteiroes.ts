import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import type { GerarLoteQuarteiraoInput } from '../dtos/gerar-lote-quarteiroes.body';

export interface GerarLoteResult {
  totalSolicitado: number;
  totalCriado: number;
  totalIgnorado: number;
  criados: string[];
  ignorados: Array<{ codigo: string; motivo: string }>;
}

@Injectable()
export class GerarLoteQuarteiroes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: GerarLoteQuarteiraoInput): Promise<GerarLoteResult> {
    // Defensive normalization — DTO already does this via Zod; belt-and-suspenders for direct callers
    const prefixo = input.prefixo.trim().toUpperCase();
    const { bairroId, numeroInicial, numeroFinal } = input;

    // Tenant isolation: region must belong to the authenticated client
    const regiao = await this.prisma.client.bairros.findFirst({
      where: { id: bairroId, cliente_id: clienteId, deleted_at: null },
      select: { id: true },
    });
    if (!regiao) {
      throw new NotFoundException('Região não encontrada ou não pertence ao cliente');
    }

    // Padding width is driven by the highest number in the range.
    // 20 quadras → width 2 (01–20), 200 → width 3 (001–200), 1200 → width 4, etc.
    const padWidth = String(numeroFinal).length;

    const codigos = Array.from(
      { length: numeroFinal - numeroInicial + 1 },
      (_, i) => `${prefixo}${String(numeroInicial + i).padStart(padWidth, '0')}`,
    );

    // Transaction tightens the race window between duplicate-check and insert
    const { criados, ignorados, totalCriado } =
      await this.prisma.client.$transaction(async (tx) => {
        // Detect codes that already exist for this tenant within the same bairro
        const existing = await tx.bairros_quadras.findMany({
          where: { cliente_id: clienteId, bairro_id: bairroId, codigo: { in: codigos } },
          select: { codigo: true },
        });
        const existingSet = new Set(existing.map((e) => e.codigo));

        const toCreate = codigos.filter((c) => !existingSet.has(c));
        const ignoradosExistentes = codigos
          .filter((c) => existingSet.has(c))
          .map((codigo) => ({ codigo, motivo: 'Já existente' }));

        if (toCreate.length === 0) {
          return { criados: [] as string[], ignorados: ignoradosExistentes, totalCriado: 0 };
        }

        try {
          const { count } = await tx.bairros_quadras.createMany({
            data: toCreate.map((codigo) => ({
              cliente_id: clienteId,
              bairro_id: bairroId,
              codigo,
              ativo: true,
            })),
            skipDuplicates: true, // relies on @@unique([cliente_id, codigo])
          });

          // Happy path: every intended row was created
          if (count === toCreate.length) {
            return { criados: toCreate, ignorados: ignoradosExistentes, totalCriado: count };
          }

          // Race condition: skipDuplicates silently skipped some rows — identify which
          const confirmed = await tx.bairros_quadras.findMany({
            where: { cliente_id: clienteId, codigo: { in: toCreate } },
            select: { codigo: true },
          });
          const confirmedSet = new Set(confirmed.map((c) => c.codigo));
          const ignoradosRace = toCreate
            .filter((c) => !confirmedSet.has(c))
            .map((codigo) => ({ codigo, motivo: 'Conflito de concorrência' }));

          return {
            criados: toCreate.filter((c) => confirmedSet.has(c)),
            ignorados: [...ignoradosExistentes, ...ignoradosRace],
            totalCriado: count,
          };
        } catch (e) {
          // P2002 can still occur if a constraint not covered by skipDuplicates is violated
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            const ignoradosConflito = toCreate.map((codigo) => ({
              codigo,
              motivo: 'Conflito de concorrência',
            }));
            return {
              criados: [],
              ignorados: [...ignoradosExistentes, ...ignoradosConflito],
              totalCriado: 0,
            };
          }
          throw e;
        }
      });

    return {
      totalSolicitado: codigos.length,
      totalCriado,
      totalIgnorado: codigos.length - totalCriado,
      criados,
      ignorados,
    };
  }
}
