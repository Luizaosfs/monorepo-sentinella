import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

/**
 * Fase C.4 — Porte do trigger legado `fn_reverter_prioridade_caso_descartado`.
 *
 * Quando um caso notificado é marcado como `descartado`:
 *   1. Remove todas as linhas de `caso_foco_cruzamento` desse caso.
 *   2. Em todos os focos ATIVOS que tinham esse caso no array `casos_ids`:
 *      a. Restaura `prioridade` para `prioridade_original_antes_caso`
 *         (via COALESCE — se `original` for NULL, mantém a prioridade atual).
 *      b. Zera `prioridade_original_antes_caso`.
 *      c. Remove o `caso_id` de `casos_ids`.
 *
 * O filtro `status NOT IN ('resolvido','descartado')` evita mexer em
 * focos já em estado terminal — a reversão só atinge focos operacionalmente
 * ativos.
 *
 * Nota sobre múltiplos casos: se um foco estava elevado por 2+ casos e apenas
 * 1 deles é descartado, o foco volta para `prioridade_original_antes_caso` —
 * ele NÃO é "re-elevado" por outros casos ainda ativos. Esse é o comportamento
 * do legado e foi preservado intencionalmente. Se o produto quiser re-elevação,
 * é decisão separada que deve expandir esse use-case.
 *
 * Idempotente: dispara apenas quando `statusAnterior != 'descartado'` e
 * `statusNovo == 'descartado'`. Re-execução com o mesmo casoId não afeta focos
 * que já tiveram o vínculo removido.
 */
export interface ReverterPrioridadeCasoDescartadoInput {
  casoId: string | undefined;
  clienteId: string;
  statusAnterior: string | undefined;
  statusNovo: string;
}

@Injectable()
export class ReverterPrioridadeCasoDescartado {
  private readonly logger = new Logger(ReverterPrioridadeCasoDescartado.name);

  constructor(private prisma: PrismaService) {}

  async execute(
    input: ReverterPrioridadeCasoDescartadoInput,
  ): Promise<{ aplicado: boolean; focosAfetados: number }> {
    const { casoId, clienteId, statusAnterior, statusNovo } = input;

    // Dispara somente na transição PARA 'descartado'
    if (!casoId || statusNovo !== 'descartado' || statusAnterior === 'descartado') {
      return { aplicado: false, focosAfetados: 0 };
    }

    await this.prisma.client.$executeRaw(Prisma.sql`
      DELETE FROM caso_foco_cruzamento
      WHERE caso_id = ${casoId}::uuid
    `);

    // Restaura a prioridade original (ou mantém a atual se original for NULL),
    // zera o backup e remove o caso_id do array. Fiel ao trigger legado
    // fn_reverter_prioridade_caso_descartado (D-02).
    const focosAfetados = await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE focos_risco
      SET
        prioridade                      = COALESCE(prioridade_original_antes_caso, prioridade),
        prioridade_original_antes_caso  = NULL,
        casos_ids                       = array_remove(casos_ids, ${casoId}::uuid),
        updated_at                      = now()
      WHERE cliente_id  = ${clienteId}::uuid
        AND deleted_at  IS NULL
        AND status      NOT IN ('resolvido', 'descartado')
        AND ${casoId}::uuid = ANY(casos_ids)
    `);

    this.logger.debug(
      `Caso ${casoId} descartado: ${Number(focosAfetados)} foco(s) tiveram prioridade revertida.`,
    );

    return { aplicado: true, focosAfetados: Number(focosAfetados) };
  }
}
