# Raw Query Hardening — Sentinella Backend

## Contexto

O backend usa Prisma ORM com `$queryRaw` e `Prisma.sql` para queries analíticas e filtros complexos.
Todos os valores injetados via `Prisma.sql`\`${value}\`` são **parametrizados** — nunca interpolados diretamente no SQL.
Isso elimina SQL injection clássico. O hardening aqui adiciona **validação de domínio** (defense-in-depth).

---

## Riscos Encontrados (Auditoria 2026-05-05)

| Arquivo | Tipo | Severidade | Status |
|---------|------|------------|--------|
| `prisma-foco-risco-read.repository.ts` | `Prisma.join(status)` sem whitelist | Médio | ✅ Corrigido |
| `prisma-foco-risco-read.repository.ts` | `Prisma.join(prioridade)` sem whitelist | Médio | ✅ Corrigido |
| `filter-foco-risco.input.ts` | `orderBy: z.string()` sem enum | Baixo | ✅ Corrigido |
| `listar-com-vinculos.ts` | `status`/`tipoVinculo` sem whitelist | Baixo | ✅ Corrigido |
| `list-vistorias-consolidadas.ts` | `prioridade_final` sem whitelist | Baixo | ✅ Corrigido |
| `$queryRawUnsafe` | Uso direto | Alto | ✅ Zero instâncias |
| Analytics dashboards | ORDER BY estático | N/A | ✅ Seguro (hardcoded) |
| Tenant isolation | `cliente_id` em raw queries | Crítico | ✅ Todos respeitam |

---

## Padrões PROIBIDOS

```typescript
// ❌ NUNCA — string interpolada em SQL
const sql = `SELECT * FROM focos_risco WHERE status = '${userInput}'`;

// ❌ NUNCA — queryRawUnsafe com input externo
prisma.$queryRawUnsafe(`SELECT * FROM t WHERE status = '${filters.status}'`);

// ❌ NUNCA — Prisma.join sem validação prévia de whitelist
Prisma.sql`f.status IN (${Prisma.join(filters.status)})` // parametrizado, mas sem whitelist

// ❌ NUNCA — orderBy interpolado
Prisma.sql`ORDER BY ${coluna} ${direcao}` // coluna/direcao vindas do request

// ❌ NUNCA — aceitar qualquer string em filtro de enum no DTO
orderBy: z.string().optional() // livre demais
```

---

## Padrões PERMITIDOS

```typescript
// ✅ Whitelist + assertFocoStatus antes de qualquer uso em SQL
import { assertFocoStatus } from '@shared/security/sql-whitelists';

if (filters.status?.length) {
  assertFocoStatus(filters.status); // lança BadRequestException se inválido
  clauses.push(
    filters.status.length === 1
      ? Prisma.sql`f.status = ${filters.status[0]}`
      : Prisma.sql`f.status = ANY(${filters.status}::text[])`, // ANY > IN
  );
}

// ✅ enum no DTO para campos de ordenação
orderBy: z.enum(['created_at_asc', 'created_at_desc', 'suspeita_em_asc', ...]).optional()

// ✅ direction segura via map (nunca interpolação direta)
const orderDirection = orderValue === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

// ✅ safeOrderKey com Set de colunas permitidas
const allowed = new Set(['created_at', 'suspeita_em', 'score_prioridade', ...]);
const col = allowed.has(orderKey) ? orderKey : 'created_at';

// ✅ tenant sempre parameterizado e obrigatório
Prisma.sql`WHERE cliente_id = ${clienteId}::uuid`
```

---

## Whitelist Central

Fonte da verdade: `src/shared/security/sql-whitelists.ts`

| Função | Valida | Erro |
|--------|--------|------|
| `assertFocoStatus(values)` | Status de focos_risco (9 valores) | `BadRequestException` |
| `assertPrioridade(values)` | P1–P5 | `BadRequestException` |
| `assertOperacaoStatus(value)` | pendente / em_andamento / concluido / cancelado | `BadRequestException` |
| `assertTipoVinculo(value)` | operacional / levantamento / regiao | `BadRequestException` |
| `assertPrioridadeVistoria(values)` | P1–P5 (vistorias) | `BadRequestException` |

**Sempre atualizar a whitelist aqui ao adicionar novos valores de enum no banco.**

---

## Tenant Isolation — Regras

1. Todo `$queryRaw` em módulo de domínio DEVE incluir `WHERE cliente_id = ${clienteId}::uuid`.
2. `clienteId` vem de `requireTenantId(getAccessScope(this.req))` — nunca do body/query diretamente.
3. Analytics de `admin` (sem cliente) filtram via `getClienteIdsPermitidos` ou recebem `clienteId` como parâmetro do controller após `getAccessScope`.
4. Verificar com: `grep -n 'cliente_id' <arquivo>` — toda raw query deve ter ao menos uma ocorrência.

---

## Checklist para novo `$queryRaw`

- [ ] Valores externos (status, prioridade, enum) passam por `assert*` da whitelist
- [ ] `ORDER BY` usa mapa estático (`SORT_MAP`) ou valor hardcoded — nunca interpolação
- [ ] `cliente_id = ${clienteId}::uuid` presente
- [ ] `deleted_at IS NULL` presente (onde aplicável)
- [ ] Nenhum `$queryRawUnsafe`
- [ ] Testes cobrem valor inválido → `BadRequestException`

---

## Pendências (risco residual aceito)

| Local | Motivo | Mitigação |
|-------|--------|-----------|
| `filters.origem_tipo` em `buildSqlWhere` | String livre, mas raramente exposto via API pública | Parameterizado — sem risco de injection |
| `filters.classificacao_inicial` em `buildSqlWhere` | String livre | Parameterizado — sem risco de injection |
| Analytics dashboards (executivo, piloto, reincidência) | Sem filtros externos — `clienteId` é o único input | Todos parameterizados |
