import { Prisma } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';
import { CLS_USER_ID_KEY } from 'src/shared/interceptors/user-context.interceptor';

/**
 * Lookup MODELO → COLUNA de autoria para operações de INSERT.
 *
 * - `focos_risco`, `casos_notificados`, `vistorias` usam `created_by`.
 * - `foco_risco_historico`, `levantamento_item_status_historico` usam
 *   `alterado_por` (são tabelas-ledger — só recebem INSERT, nunca UPDATE).
 *
 * Fonte da verdade: `apps/backend/prisma/schema/*.prisma` — qualquer adição
 * de coluna de autoria em novo modelo exige entrada aqui.
 *
 * Implementado como Map (não Record) — Record<string, union-literal> acessado
 * pela variável `model` do Prisma quebra a inferência do callback `$allOperations`
 * ("query is never"). Map<string, string> não sofre disso.
 */
const INSERT_AUTHOR_COLUMN = new Map<string, string>([
  ['focos_risco', 'created_by'],
  ['casos_notificados', 'created_by'],
  ['vistorias', 'created_by'],
  ['foco_risco_historico', 'alterado_por'],
  ['levantamento_item_status_historico', 'alterado_por'],
]);

/**
 * Lookup MODELO → COLUNA de autoria para operações de UPDATE.
 * Apenas `levantamento_itens` — única tabela com `updated_by`.
 */
const UPDATE_AUTHOR_COLUMN = new Map<string, string>([
  ['levantamento_itens', 'updated_by'],
]);

const INSERT_OPERATIONS = new Set<string>(['create', 'createMany', 'upsert']);
const UPDATE_OPERATIONS = new Set<string>(['update', 'updateMany', 'upsert']);

/**
 * Lê o ID do usuário logado do CLS. Retorna `null` se não houver request ativa
 * (crons, seeds, scripts) — alinhado com `auth.uid()` do Supabase legado, que
 * também retornava NULL fora de contexto JWT.
 *
 * Usa `ClsServiceManager.getClsService()` (acesso estático) porque um Prisma
 * Client Extension é instanciado FORA do IoC container — não temos como
 * injetar `ClsService` via construtor.
 */
function getCurrentUserId(): string | null {
  try {
    const cls = ClsServiceManager.getClsService();
    const userId = cls.get<string | undefined>(CLS_USER_ID_KEY);
    return userId ?? null;
  } catch {
    return null;
  }
}

function injectAuthor(
  target: Record<string, unknown>,
  column: string,
  userId: string,
): Record<string, unknown> {
  if (column in target) return target;
  return { ...target, [column]: userId };
}

/**
 * Prisma Client Extension que injeta `created_by` / `alterado_por` em INSERTs
 * e `updated_by` em UPDATEs das 6 tabelas LGPD listadas nos mapas acima.
 *
 * Respeita valor explícito do chamador: se o campo já está no `data`/`create`/
 * `update`, NÃO sobrescreve (use-case pode estar forçando autoria específica,
 * ex.: migração batch com `system` como autor).
 *
 * Aplicado EM CIMA do `updated-at.extension` em `prisma.service.ts` via
 * `.$extends(createdByExtension)` direto (sem factory genérica — quebraria
 * o TypeMap do Prisma).
 *
 * Nota: este extension NÃO muda o tipo público do cliente (extensions do tipo
 * `query` só interceptam operações existentes). Por isso `ExtendedPrismaClient`
 * em `updated-at.extension.ts` permanece baseado apenas em `updated-at`.
 */
export const createdByExtension = Prisma.defineExtension({
  name: 'sentinella-created-by',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Prisma tipa `model` como union de literais dos modelos; passar direto
        // para `Map<string,_>.get()` quebra a inferência do callback (query vira
        // `never`). Coerção para `string` primitivo restaura a inferência.
        const modelName: string = String(model ?? '');
        if (!modelName) {
          return query(args);
        }

        const insertColumn = INSERT_AUTHOR_COLUMN.get(modelName);
        const updateColumn = UPDATE_AUTHOR_COLUMN.get(modelName);

        if (!insertColumn && !updateColumn) {
          return query(args);
        }

        const isInsertOp = INSERT_OPERATIONS.has(operation);
        const isUpdateOp = UPDATE_OPERATIONS.has(operation);
        const needsInsert = Boolean(insertColumn) && isInsertOp;
        const needsUpdate = Boolean(updateColumn) && isUpdateOp;

        if (!needsInsert && !needsUpdate) {
          return query(args);
        }

        const userId = getCurrentUserId();
        if (!userId) {
          return query(args);
        }

        const nextArgs = args as {
          data?: unknown;
          create?: unknown;
          update?: unknown;
        } & typeof args;

        if (operation === 'upsert') {
          if (needsInsert && insertColumn) {
            const create = nextArgs.create as
              | Record<string, unknown>
              | undefined;
            if (create) {
              nextArgs.create = injectAuthor(create, insertColumn, userId);
            }
          }
          if (needsUpdate && updateColumn) {
            const update = nextArgs.update as
              | Record<string, unknown>
              | undefined;
            if (update) {
              nextArgs.update = injectAuthor(update, updateColumn, userId);
            }
          }
        } else if (operation === 'createMany' && insertColumn) {
          const data = nextArgs.data as
            | Record<string, unknown>
            | Record<string, unknown>[]
            | undefined;
          if (Array.isArray(data)) {
            const column = insertColumn;
            nextArgs.data = data.map((row) =>
              injectAuthor(row, column, userId),
            );
          } else if (data) {
            nextArgs.data = injectAuthor(data, insertColumn, userId);
          }
        } else if (needsInsert && insertColumn) {
          const data = nextArgs.data as Record<string, unknown> | undefined;
          if (data) {
            nextArgs.data = injectAuthor(data, insertColumn, userId);
          }
        } else if (needsUpdate && updateColumn) {
          const data = nextArgs.data as Record<string, unknown> | undefined;
          if (data && !Array.isArray(data)) {
            nextArgs.data = injectAuthor(data, updateColumn, userId);
          }
        }

        return query(nextArgs);
      },
    },
  },
});

/**
 * Exportado apenas para testes.
 * @internal
 */
export const __INSERT_AUTHOR_COLUMN_FOR_TEST = INSERT_AUTHOR_COLUMN;
export const __UPDATE_AUTHOR_COLUMN_FOR_TEST = UPDATE_AUTHOR_COLUMN;

export { getCurrentUserId as __getCurrentUserIdForTest };
