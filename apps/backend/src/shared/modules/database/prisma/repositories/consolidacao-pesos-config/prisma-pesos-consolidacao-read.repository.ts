import { PesosConsolidacaoReadRepository } from '@modules/consolidacao-pesos-config/repositories/pesos-consolidacao-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaService } from '../../prisma.service';

const ZERO = new Prisma.Decimal('0');

@PrismaRepository(PesosConsolidacaoReadRepository)
@Injectable()
export class PrismaPesosConsolidacaoReadRepository
  implements PesosConsolidacaoReadRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findLimiar(
    flagNome: 'limiar_baixo_medio' | 'limiar_medio_alto',
    clienteId: string,
  ): Promise<{ peso: Prisma.Decimal; versao: string } | null> {
    const rows = await this.prisma.client.$queryRaw<
      Array<{ peso: string; versao: string }>
    >(Prisma.sql`
      SELECT peso::text AS peso, versao
      FROM consolidacao_pesos_config
      WHERE flag_nome = ${flagNome}
        AND ativo = true
        AND (cliente_id = ${clienteId}::uuid OR cliente_id IS NULL)
      ORDER BY (cliente_id = ${clienteId}::uuid) DESC, criado_em DESC
      LIMIT 1
    `);
    if (!rows.length) return null;
    return { peso: new Prisma.Decimal(rows[0].peso), versao: rows[0].versao };
  }

  async findFlagsSemPeso(
    flagsAtivas: string[],
    clienteId: string,
  ): Promise<string[]> {
    if (!flagsAtivas.length) return [];
    const rows = await this.prisma.client.$queryRaw<
      Array<{ flag_nome: string }>
    >(Prisma.sql`
      SELECT DISTINCT flag_nome
      FROM consolidacao_pesos_config
      WHERE ativo = true
        AND (cliente_id = ${clienteId}::uuid OR cliente_id IS NULL)
        AND flag_nome = ANY(ARRAY[${Prisma.join(flagsAtivas)}])
    `);
    const comPeso = new Set(rows.map((r) => r.flag_nome));
    return flagsAtivas.filter((f) => !comPeso.has(f));
  }

  async calcularScoresEfetivos(
    flagsAtivas: string[],
    clienteId: string,
  ): Promise<{ scoreSocial: Prisma.Decimal; scoreSanitario: Prisma.Decimal }> {
    if (!flagsAtivas.length) {
      return { scoreSocial: ZERO, scoreSanitario: ZERO };
    }
    const rows = await this.prisma.client.$queryRaw<
      Array<{ score_social: string; score_sanitario: string }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(peso) FILTER (WHERE grupo = 'social'),    0)::text AS score_social,
        COALESCE(SUM(peso) FILTER (WHERE grupo = 'sanitario'), 0)::text AS score_sanitario
      FROM (
        SELECT DISTINCT ON (flag_nome) flag_nome, grupo, peso
        FROM consolidacao_pesos_config
        WHERE ativo = true
          AND grupo IN ('social', 'sanitario')
          AND (cliente_id = ${clienteId}::uuid OR cliente_id IS NULL)
          AND flag_nome = ANY(ARRAY[${Prisma.join(flagsAtivas)}])
        ORDER BY flag_nome,
                 (cliente_id = ${clienteId}::uuid) DESC,
                 criado_em DESC
      ) AS effective_weights
    `);
    const row = rows[0];
    return {
      scoreSocial: new Prisma.Decimal(row?.score_social ?? '0'),
      scoreSanitario: new Prisma.Decimal(row?.score_sanitario ?? '0'),
    };
  }
}
