import type { PrismaClient } from '@prisma/client';

/**
 * Operações que o audit-log extension monitora.
 *
 * Mantido como tipo literal (e não enum) — o Prisma expõe `operation` como
 * string na callback `$allOperations`, então fazemos o mapeamento via
 * `WATCHED_OPS` / `toAuditOp` no próprio extension.
 */
export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Campos cujo valor NUNCA deve aparecer em `audit_log.dados_antes` / `dados_depois`.
 *
 * - `senha_hash` (usuarios): bcrypt hash — embora irreversível, LGPD recomenda
 *   não replicar credenciais em trilhas de auditoria.
 * - `api_key` (cliente_integracoes): token bruto de integração e-SUS. `api_key_masked`
 *   (último 4 chars visíveis) continua auditável.
 *
 * Ampliar aqui conforme novas colunas sensíveis entrarem no escopo.
 */
const SENSITIVE_FIELDS = new Set<string>(['senha_hash', 'api_key']);

/**
 * Remove campos sensíveis de um snapshot antes de serializá-lo em `audit_log`.
 * Retorna `null` se o snapshot original for `null` (DELETE pode não ter `dados_depois`).
 */
export function sanitize(
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * Projeta apenas as colunas declaradas em `config.columns` de um snapshot.
 * Evita que `audit_log` fique gigante gravando colunas irrelevantes (geom,
 * jsons grandes de config etc).
 */
export function pick(
  source: Record<string, unknown> | null | undefined,
  columns: readonly string[],
): Record<string, unknown> | null {
  if (!source) return null;
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (col in source) {
      out[col] = source[col];
    }
  }
  return out;
}

/**
 * Configuração declarativa de UMA tabela auditada.
 *
 * O extension lê este mapa, decide se a operação entra em escopo, projeta as
 * colunas relevantes, sanitiza campos sensíveis e resolve `cliente_id` antes
 * de gravar `audit_log`.
 */
export interface AuditTableConfig {
  /** Nome do model Prisma (ex.: 'papeis_usuarios'). Chave do `AUDIT_CONFIG`. */
  model: string;
  /** Nome físico da tabela — vai para `audit_log.tabela`. Normalmente == model. */
  tabela: string;
  /** Operações auditadas. Tabelas diferentes podem pular operações sem interesse. */
  operations: readonly AuditOperation[];
  /** Colunas projetadas para `dados_antes`/`dados_depois`. Tudo fora daqui é descartado. */
  columns: readonly string[];
  /**
   * Resolve o `cliente_id` que irá para `audit_log.cliente_id`.
   *
   * - Tabelas com `cliente_id` direto (cliente_plano, cliente_integracoes, usuarios)
   *   retornam `record.cliente_id`.
   * - `papeis_usuarios` NÃO tem `cliente_id` direto — precisa de lookup em `usuarios`
   *   via `auth_id`. Ver `resolveClienteIdForPapeis` no extension.
   */
  resolveClienteId: (
    record: Record<string, unknown>,
    rawClient: PrismaClient,
  ) => Promise<string | null>;
  /**
   * Filtro opcional: se definido e retornar `false`, o extension NÃO grava audit_log.
   *
   * Uso: `usuarios` audita apenas quando `ativo` muda (soft-delete / reativação).
   * Edições normais de perfil (nome, email) são ruído — ficam fora da trilha.
   */
  shouldAudit?: (
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    operation: AuditOperation,
  ) => boolean;

  /**
   * Resolver opcional para a ação nomeada gravada em `audit_log.operacao`.
   *
   * Se ausente, o extension grava `operation` direto (`'INSERT'` / `'UPDATE'`
   * / `'DELETE'`). Se presente, deve retornar uma string legível como
   * `'papel_atribuido'`, `'tenant_suspenso'`, `'integracao_criada'`, etc.
   *
   * O resolver recebe `before`/`after` (já projetados pelas `columns`) e a
   * operação canônica, e deve ser PURO — sem I/O, sem efeito colateral.
   *
   * Retorna:
   *   - string → valor literal gravado em `audit_log.operacao`
   *   - null   → cai no fallback (operation em uppercase)
   */
  resolveAction?: (
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    operation: AuditOperation,
  ) => string | null;
}

/**
 * Helper: extrai `cliente_id` direto de um record. `null` se ausente/inválido.
 */
function directClienteId(record: Record<string, unknown>): string | null {
  const value = record.cliente_id;
  return typeof value === 'string' ? value : null;
}

/**
 * Mapa MODELO → configuração de auditoria.
 *
 * Escopo fechado (4 tabelas administrativas/LGPD). Ampliar aqui exige adicionar
 * testes correspondentes em `audit-log.config.spec.ts`.
 *
 * ⚠️ `sla_config` FICA DE FORA (tem modelo dedicado e motor próprio de versionamento).
 */
export const AUDIT_CONFIG = new Map<string, AuditTableConfig>([
  [
    'papeis_usuarios',
    {
      model: 'papeis_usuarios',
      tabela: 'papeis_usuarios',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
      columns: ['id', 'usuario_id', 'papel'],
      // `papeis_usuarios.usuario_id` aponta para `usuarios.auth_id`, NÃO para `usuarios.id`.
      // Lookup é feito no extension (`resolveClienteIdForPapeis`) — aqui delegamos.
      resolveClienteId: async (record, rawClient) => {
        const authId = record.usuario_id;
        if (typeof authId !== 'string') return null;
        try {
          const usuario = await rawClient.usuarios.findUnique({
            where: { auth_id: authId },
            select: { cliente_id: true },
          });
          return usuario?.cliente_id ?? null;
        } catch {
          return null;
        }
      },
      // ── Ações nomeadas (alinhado com fn_audit_papeis_usuarios do legado) ──
      resolveAction: (_before, _after, operation) => {
        if (operation === 'INSERT') return 'papel_atribuido';
        if (operation === 'UPDATE') return 'papel_alterado';
        return 'papel_removido';
      },
    },
  ],
  [
    'cliente_plano',
    {
      model: 'cliente_plano',
      tabela: 'cliente_plano',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
      columns: [
        'id',
        'cliente_id',
        'plano_id',
        'status',
        'data_inicio',
        'data_fim',
        'data_trial_fim',
        'contrato_ref',
      ],
      resolveClienteId: async (record) => directClienteId(record),
      /**
       * `cliente_plano` só audita UPDATEs que mudam `status` ou `plano_id`.
       * Edições de `contrato_ref`, `data_fim` etc. são ruído.
       * INSERT e DELETE sempre auditam (ainda que o legado só tivesse trigger
       * de UPDATE — aqui expandimos cobertura mantendo a redução de ruído).
       */
      shouldAudit: (before, after, operation) => {
        if (operation !== 'UPDATE') return true;
        if (!before || !after) return true;
        const statusMudou = before.status !== after.status;
        const planoMudou = before.plano_id !== after.plano_id;
        return statusMudou || planoMudou;
      },

      /**
       * Ações nomeadas alinhadas com `fn_audit_cliente_plano` do legado.
       * INSERT/DELETE caem no fallback (legado só auditava UPDATE).
       */
      resolveAction: (before, after, operation) => {
        if (operation !== 'UPDATE') return null;
        if (!before || !after) return null;

        const statusMudou = before.status !== after.status;
        const newStatus = after.status;

        if (statusMudou && typeof newStatus === 'string') {
          switch (newStatus) {
            case 'suspenso':
              return 'tenant_suspenso';
            case 'cancelado':
              return 'tenant_cancelado';
            case 'inadimplente':
              return 'tenant_inadimplente';
            case 'trial':
              return 'tenant_trial_iniciado';
            case 'ativo':
              return 'tenant_reativado';
            default:
              return 'plano_status_alterado';
          }
        }

        // Só plano_id mudou
        if (before.plano_id !== after.plano_id) return 'plano_alterado';

        // shouldAudit teria retornado false aqui — defesa em profundidade
        return null;
      },
    },
  ],
  [
    'cliente_integracoes',
    {
      model: 'cliente_integracoes',
      tabela: 'cliente_integracoes',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
      // `api_key` fica DE FORA — também é filtrado por `sanitize()` como cinto-e-suspensório.
      // `api_key_masked` (últimos 4 chars) continua auditável.
      columns: [
        'id',
        'cliente_id',
        'tipo',
        'endpoint_url',
        'codigo_ibge',
        'unidade_saude_cnes',
        'ambiente',
        'ativo',
        'api_key_masked',
      ],
      resolveClienteId: async (record) => directClienteId(record),
      // ── Ações nomeadas (alinhado com fn_audit_integracoes do legado) ──
      resolveAction: (_before, _after, operation) => {
        if (operation === 'INSERT') return 'integracao_criada';
        if (operation === 'UPDATE') return 'integracao_alterada';
        return 'integracao_removida';
      },
    },
  ],
  [
    'usuarios',
    {
      model: 'usuarios',
      tabela: 'usuarios',
      operations: ['INSERT', 'UPDATE', 'DELETE'],
      // `senha_hash` também é filtrado por `sanitize()`.
      columns: [
        'id',
        'auth_id',
        'nome',
        'email',
        'cliente_id',
        'ativo',
        'agrupamento_id',
      ],
      resolveClienteId: async (record) => directClienteId(record),
      /**
       * UPDATE em `usuarios` só é auditado quando `ativo` muda (ativação/desativação).
       * Alterações de nome/email/agrupamento geram volume sem valor de auditoria.
       * INSERT e DELETE sempre auditam (soft-delete via UPDATE + hard-delete via DELETE).
       */
      shouldAudit: (before, after, operation) => {
        if (operation !== 'UPDATE') return true;
        if (!before || !after) return true;
        return before.ativo !== after.ativo;
      },
      /**
       * Ações nomeadas (alinhado com fn_audit_usuarios_status do legado).
       * Legado não cobria INSERT; aqui retornamos null para cair no fallback.
       */
      resolveAction: (before, after, operation) => {
        if (operation === 'DELETE') return 'usuario_removido';
        if (operation === 'UPDATE' && before && after) {
          if (before.ativo === true && after.ativo === false) {
            return 'usuario_desativado';
          }
          if (before.ativo === false && after.ativo === true) {
            return 'usuario_reativado';
          }
        }
        return null; // INSERT e UPDATEs sem mudança de ativo → fallback
      },
    },
  ],
]);

/**
 * Exportado apenas para testes.
 * @internal
 */
export const __SENSITIVE_FIELDS_FOR_TEST = SENSITIVE_FIELDS;
