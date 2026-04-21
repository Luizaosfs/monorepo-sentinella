import { Prisma, type PrismaClient } from '@prisma/client';
import { ClsServiceManager } from 'nestjs-cls';
import { CLS_USER_ID_KEY } from 'src/shared/interceptors/user-context.interceptor';

import {
  AUDIT_CONFIG,
  type AuditOperation,
  type AuditTableConfig,
  pick,
  sanitize,
} from './audit-log.config';

/**
 * Operações do Prisma mapeadas para audit operations.
 *
 * `upsert` NÃO está aqui: como um upsert pode virar INSERT ou UPDATE em runtime,
 * tratamos ele em um branch dedicado (detectamos via try/lookup antes do query).
 */
const WATCHED_OPS = new Set<string>([
  'create',
  'createMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

/**
 * Converte operação Prisma em rótulo `audit_log.operacao`.
 */
function toAuditOp(operation: string): AuditOperation | null {
  if (operation === 'create' || operation === 'createMany') return 'INSERT';
  if (operation === 'update' || operation === 'updateMany') return 'UPDATE';
  if (operation === 'delete' || operation === 'deleteMany') return 'DELETE';
  return null;
}

/**
 * Lê `auth_id` do usuário logado do CLS → traduz para `usuarios.id` (FK de
 * `audit_log.usuario_id`). Fora de request (crons/seeds) retorna `null`.
 *
 * Fail-safe: qualquer erro de CLS ou lookup → `null` (audit_log.usuario_id
 * fica NULL, registro ainda é gravado).
 */
async function getUsuarioIdFromCls(
  rawClient: PrismaClient,
): Promise<string | null> {
  try {
    const cls = ClsServiceManager.getClsService();
    const authId = cls.get<string | undefined>(CLS_USER_ID_KEY);
    if (!authId) return null;
    const usuario = await rawClient.usuarios.findUnique({
      where: { auth_id: authId },
      select: { id: true },
    });
    return usuario?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Extrai ID único de um `where` do Prisma. Para `where: { id: 'x' }` retorna 'x'.
 * Para `where: { id: { equals: 'x' } }` também retorna 'x'. Qualquer outro
 * formato (compound keys, operadores complexos) → `null`.
 */
function extractSingleIdFromWhere(where: unknown): string | null {
  if (!where || typeof where !== 'object') return null;
  const w = where as Record<string, unknown>;
  const id = w.id;
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object') {
    const inner = (id as Record<string, unknown>).equals;
    if (typeof inner === 'string') return inner;
  }
  return null;
}

type AuditEntry = {
  readonly config: AuditTableConfig;
  readonly operation: AuditOperation;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly registroId: string | null;
};

/**
 * Grava em `audit_log` fire-and-forget.
 *
 * - NÃO lança: qualquer erro vira no-op silencioso (catch no .catch()).
 * - NÃO espera: o `.catch()` sem `await` aqui é intencional — o caller já
 *   retornou o resultado da operação original; o write de audit é um efeito
 *   colateral que não deve nem atrasar nem derrubar a request.
 * - Usa `rawClient` (não o estendido) — evitar recursão: se usássemos o
 *   cliente estendido, o INSERT em `audit_log` seria interceptado por este
 *   mesmo extension (loop infinito).
 */
function writeAuditLog(rawClient: PrismaClient, entry: AuditEntry): void {
  const { config, operation, before, after, registroId } = entry;

  if (config.shouldAudit && !config.shouldAudit(before, after, operation)) {
    return;
  }

  // Fire-and-forget: promessa detached, erro engolido.
  void (async () => {
    try {
      const source = after ?? before ?? {};
      const clienteId = await config.resolveClienteId(source, rawClient);
      const usuarioId = await getUsuarioIdFromCls(rawClient);

      const dadosAntes = sanitize(pick(before, config.columns));
      const dadosDepois = sanitize(pick(after, config.columns));

      await rawClient.audit_log.create({
        data: {
          cliente_id: clienteId,
          usuario_id: usuarioId,
          tabela: config.tabela,
          registro_id: registroId,
          dados_antes:
            dadosAntes === null
              ? Prisma.JsonNull
              : (dadosAntes as Prisma.InputJsonValue),
          dados_depois:
            dadosDepois === null
              ? Prisma.JsonNull
              : (dadosDepois as Prisma.InputJsonValue),
          operacao: config.resolveAction?.(before, after, operation) ?? operation,
        },
      });
    } catch {
      // Silencioso: auditoria NUNCA pode quebrar a operação de negócio.
    }
  })();
}

/**
 * Factory do extension de audit-log.
 *
 * Recebe `rawClient` (cliente Prisma **sem** extensions aplicadas) para:
 * 1. Evitar recursão (INSERT em audit_log dentro do extension = loop infinito
 *    se usássemos o cliente estendido).
 * 2. Evitar "puxar" outras extensions para dentro do audit_log (created_by
 *    em audit_log não faz sentido).
 *
 * Aplicado via `.$extends(buildAuditLogExtension(this.prisma))` em
 * `prisma.service.ts`, encadeado APÓS `updated-at` e `created-by`.
 *
 * Padrão fail-safe transparente:
 *   - Try/catch silencioso ao redor de TODA lógica de audit.
 *   - Fire-and-forget no write (nunca atrasa a request).
 *   - Se algo falhar internamente, a operação de negócio segue normal.
 */
export function buildAuditLogExtension(rawClient: PrismaClient) {
  return Prisma.defineExtension({
    name: 'sentinella-audit-log',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // String coercion para restaurar inferência do callback (ver notas
          // em created-by.extension.ts / updated-at.extension.ts).
          const modelName: string = String(model ?? '');
          if (!modelName || !WATCHED_OPS.has(operation)) {
            return query(args);
          }

          const config = AUDIT_CONFIG.get(modelName);
          if (!config) {
            return query(args);
          }

          // ------ UPSERT ------
          // upsert pode virar INSERT ou UPDATE. Detectamos via lookup prévio.
          if (operation === 'upsert') {
            const upsertArgs = args as {
              where?: unknown;
              create?: Record<string, unknown>;
              update?: Record<string, unknown>;
            };
            let before: Record<string, unknown> | null = null;
            const registroId = extractSingleIdFromWhere(upsertArgs.where);
            try {
              if (registroId) {
                const existing = await (
                  rawClient as unknown as Record<
                    string,
                    { findUnique: (a: unknown) => Promise<unknown> }
                  >
                )[modelName]?.findUnique({ where: { id: registroId } });
                before = (existing as Record<string, unknown> | null) ?? null;
              }
            } catch {
              before = null;
            }

            const result = (await query(args)) as Record<
              string,
              unknown
            > | null;
            const auditOp: AuditOperation = before ? 'UPDATE' : 'INSERT';
            if (config.operations.includes(auditOp)) {
              writeAuditLog(rawClient, {
                config,
                operation: auditOp,
                before,
                after: result,
                registroId: (result?.id as string) ?? registroId,
              });
            }
            return result;
          }

          // ------ CREATE ------
          if (operation === 'create') {
            if (!config.operations.includes('INSERT')) {
              return query(args);
            }
            const result = (await query(args)) as Record<
              string,
              unknown
            > | null;
            writeAuditLog(rawClient, {
              config,
              operation: 'INSERT',
              before: null,
              after: result,
              registroId: (result?.id as string) ?? null,
            });
            return result;
          }

          // ------ CREATE MANY ------
          // Prisma retorna só `{ count }` — não temos os rows inseridos.
          // Gravamos um único entry com `registro_id=null` e `dados_depois`
          // resumido (count + amostra). LGPD prefere ter algum sinal do que
          // nenhum quando o chamador usa bulk.
          if (operation === 'createMany') {
            if (!config.operations.includes('INSERT')) {
              return query(args);
            }
            const result = (await query(args)) as { count?: number } | null;
            const createArgs = args as { data?: unknown };
            const sampleAfter = Array.isArray(createArgs.data)
              ? {
                  __bulk: true,
                  count: result?.count ?? null,
                  first:
                    (createArgs.data[0] as Record<string, unknown>) ?? null,
                }
              : {
                  __bulk: true,
                  count: result?.count ?? null,
                  first: (createArgs.data as Record<string, unknown>) ?? null,
                };
            writeAuditLog(rawClient, {
              config,
              operation: 'INSERT',
              before: null,
              after: sampleAfter,
              registroId: null,
            });
            return result;
          }

          // ------ UPDATE ------
          if (operation === 'update') {
            if (!config.operations.includes('UPDATE')) {
              return query(args);
            }
            const updateArgs = args as { where?: unknown };
            const registroId = extractSingleIdFromWhere(updateArgs.where);
            let before: Record<string, unknown> | null = null;
            try {
              if (registroId) {
                const existing = await (
                  rawClient as unknown as Record<
                    string,
                    { findUnique: (a: unknown) => Promise<unknown> }
                  >
                )[modelName]?.findUnique({ where: { id: registroId } });
                before = (existing as Record<string, unknown> | null) ?? null;
              }
            } catch {
              before = null;
            }
            const result = (await query(args)) as Record<
              string,
              unknown
            > | null;
            writeAuditLog(rawClient, {
              config,
              operation: 'UPDATE',
              before,
              after: result,
              registroId: (result?.id as string) ?? registroId,
            });
            return result;
          }

          // ------ UPDATE MANY ------
          if (operation === 'updateMany') {
            if (!config.operations.includes('UPDATE')) {
              return query(args);
            }
            const result = (await query(args)) as { count?: number } | null;
            const updateArgs = args as { data?: unknown; where?: unknown };
            writeAuditLog(rawClient, {
              config,
              operation: 'UPDATE',
              before: null,
              after: {
                __bulk: true,
                count: result?.count ?? null,
                where: updateArgs.where as Record<string, unknown>,
                data: updateArgs.data as Record<string, unknown>,
              },
              registroId: null,
            });
            return result;
          }

          // ------ DELETE ------
          if (operation === 'delete') {
            if (!config.operations.includes('DELETE')) {
              return query(args);
            }
            const deleteArgs = args as { where?: unknown };
            const registroId = extractSingleIdFromWhere(deleteArgs.where);
            let before: Record<string, unknown> | null = null;
            try {
              if (registroId) {
                const existing = await (
                  rawClient as unknown as Record<
                    string,
                    { findUnique: (a: unknown) => Promise<unknown> }
                  >
                )[modelName]?.findUnique({ where: { id: registroId } });
                before = (existing as Record<string, unknown> | null) ?? null;
              }
            } catch {
              before = null;
            }
            const result = await query(args);
            writeAuditLog(rawClient, {
              config,
              operation: 'DELETE',
              before,
              after: null,
              registroId,
            });
            return result;
          }

          // ------ DELETE MANY ------
          if (operation === 'deleteMany') {
            if (!config.operations.includes('DELETE')) {
              return query(args);
            }
            const result = (await query(args)) as { count?: number } | null;
            const deleteArgs = args as { where?: unknown };
            writeAuditLog(rawClient, {
              config,
              operation: 'DELETE',
              before: null,
              after: {
                __bulk: true,
                count: result?.count ?? null,
                where: deleteArgs.where as Record<string, unknown>,
              },
              registroId: null,
            });
            return result;
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Helpers exportados APENAS para testes unitários.
 * @internal
 */
export const __TEST_ONLY = {
  toAuditOp,
  extractSingleIdFromWhere,
  WATCHED_OPS,
};
