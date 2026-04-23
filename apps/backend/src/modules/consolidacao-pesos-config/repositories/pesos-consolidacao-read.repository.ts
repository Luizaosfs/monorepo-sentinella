import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export abstract class PesosConsolidacaoReadRepository {
  abstract findLimiar(
    flagNome: 'limiar_baixo_medio' | 'limiar_medio_alto',
    clienteId: string,
  ): Promise<{ peso: Prisma.Decimal; versao: string } | null>;

  abstract findFlagsSemPeso(
    flagsAtivas: string[],
    clienteId: string,
  ): Promise<string[]>;

  abstract calcularScoresEfetivos(
    flagsAtivas: string[],
    clienteId: string,
  ): Promise<{ scoreSocial: Prisma.Decimal; scoreSanitario: Prisma.Decimal }>;
}
