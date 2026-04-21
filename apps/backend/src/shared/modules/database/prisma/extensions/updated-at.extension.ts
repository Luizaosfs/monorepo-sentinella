import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Lista EXPLÍCITA de modelos Prisma que possuem coluna `updated_at`.
 *
 * Motivação: o Prisma Client não expõe introspection de colunas em runtime de
 * forma barata. Tentar injetar `updated_at` em modelos que não têm a coluna
 * gera `PrismaClientValidationError` ("Unknown arg `updated_at` ...").
 *
 * Fonte da verdade: `grep -lE '^\s+updated_at\s+' apps/backend/prisma/schema/*.prisma`
 *
 * ⚠️ AO ADICIONAR COLUNA `updated_at` EM UM NOVO MODELO, adicionar o nome aqui
 * (snake_case, exatamente como está no `model <nome> {` do Prisma).
 */
const MODELS_WITH_UPDATED_AT = new Set<string>([
  'agrupamento_regional',
  'billing_ciclo',
  'casos_notificados',
  'ciclos',
  'cliente_integracoes',
  'cliente_plano',
  'cliente_quotas',
  'clientes',
  'distribuicao_quarteirao',
  'drones',
  'focos_risco',
  'imoveis',
  'item_notificacoes_esus',
  'job_queue',
  'levantamento_itens',
  'levantamentos',
  'operacoes',
  'planejamento',
  'plano_acao_catalogo',
  'pluvio_risco',
  'quarteiroes',
  'regioes',
  'reinspecoes_programadas',
  'score_config',
  'sentinela_drone_risk_config',
  'sentinela_risk_policy',
  'sentinela_yolo_class_config',
  'sla_config',
  'sla_config_regiao',
  'sla_foco_config',
  'sla_operacional',
  'territorio_score',
  'unidades_saude',
  'usuarios',
  'vistorias',
  'voos',
]);

/**
 * Conjunto de operações de mutação em que `updated_at` deve ser injetado
 * quando o modelo tem essa coluna e o chamador não passou valor explícito.
 *
 * Nota: `create`/`createMany` NÃO entram aqui — `@default(now())` do Prisma
 * já cuida do INSERT. O problema é só UPDATE no Postgres sem trigger.
 *
 * Nota 2: `upsert` injeta apenas no branch `update` (o branch `create` cai
 * no `@default`). Ver lógica abaixo.
 */
const UPDATE_OPERATIONS = new Set<string>(['update', 'updateMany', 'upsert']);

/**
 * Prisma Client Extension que injeta `updated_at = new Date()` em todas as
 * operações de UPDATE em modelos que têm essa coluna.
 *
 * Respeita valor explícito passado pelo chamador: se `args.data.updated_at`
 * já foi setado (ex.: use-case que quer forçar um timestamp específico), NÃO
 * sobrescreve.
 *
 * Usa `Prisma.defineExtension` para permitir reutilização entre clientes
 * (melhor para testes unitários do que inline `.$extends({...})`).
 */
export const updatedAtExtension = Prisma.defineExtension({
  name: 'sentinella-updated-at',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Fora do escopo: leituras, deletes, raw queries, aggregate, count, etc.
        if (!UPDATE_OPERATIONS.has(operation)) {
          return query(args);
        }

        // Fora do escopo: modelo não tem coluna updated_at
        if (!model || !MODELS_WITH_UPDATED_AT.has(model)) {
          return query(args);
        }

        const nextArgs = args as {
          data?: unknown;
          update?: unknown;
        } & typeof args;

        if (operation === 'upsert') {
          // upsert tem `create` e `update`. Só tocar em `update`.
          const update = nextArgs.update as Record<string, unknown> | undefined;
          if (update && !('updated_at' in update)) {
            nextArgs.update = { ...update, updated_at: new Date() };
          }
        } else {
          // update / updateMany: `data` pode ser objeto ou array (Prisma 6+ createMany-like, mas
          // para update sempre é objeto; para updateMany é objeto; array só no createMany).
          const data = nextArgs.data as Record<string, unknown> | undefined;
          if (data && !Array.isArray(data) && !('updated_at' in data)) {
            nextArgs.data = { ...data, updated_at: new Date() };
          }
        }

        return query(nextArgs);
      },
    },
  },
});

/**
 * Factory que aplica o extension `updated-at` a um PrismaClient.
 *
 * Existe como função (e não só `$extends` inline em `prisma.service.ts`) porque
 * o TypeScript só consegue inferir o tipo do cliente estendido quando os
 * argumentos concretos do `$extends` são visíveis ao compilador. Veja:
 *   https://www.prisma.io/docs/orm/prisma-client/client-extensions
 *   (seção "Type of an extended client")
 *
 * Uso no PrismaService:
 *   import { applyUpdatedAtExtension, type ExtendedPrismaClient } from '...';
 *   private extendedPrisma: ExtendedPrismaClient;
 *   this.extendedPrisma = applyUpdatedAtExtension(this.prisma);
 */
export function applyUpdatedAtExtension(client: PrismaClient) {
  return client.$extends(updatedAtExtension);
}

/**
 * Tipo do cliente PrismaClient após aplicação das extensions do Sentinella.
 *
 * Ancorado na factory `applyUpdatedAtExtension`. O runtime pode ter extensions
 * adicionais encadeadas em cima (ex.: `createdByExtension` da Fase B.1 — ver
 * `prisma.service.ts`); esse tipo não reflete elas porque Prisma Client
 * Extensions do tipo `query` não alteram a superfície pública tipada do cliente
 * (só interceptam operações existentes). Portanto este tipo permanece como
 * fonte única de verdade consumida por `PrismaContext`, `TransactionInterceptor`, etc.
 */
export type ExtendedPrismaClient = ReturnType<typeof applyUpdatedAtExtension>;

/**
 * Tipo do `tx` recebido pelo callback de `$transaction` no cliente estendido.
 * Substitui `Prisma.TransactionClient` em consumidores que dependem do cliente
 * retornado por `PrismaService.client` (ex.: PrismaContext, TransactionInterceptor).
 */
export type ExtendedTransactionClient = Parameters<
  Parameters<ExtendedPrismaClient['$transaction']>[0]
>[0];

/**
 * Lista exportada apenas para uso em testes.
 * @internal
 */
export const __MODELS_WITH_UPDATED_AT_FOR_TEST = MODELS_WITH_UPDATED_AT;
