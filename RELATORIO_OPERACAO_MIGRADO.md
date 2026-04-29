# Relatório de migração — módulo operacao
# req['tenantId'] → AccessScope

## Data
29/04/2026

## Commits
ae7259c..ec80b89 (7 commits, push em main)

| Hash | Descrição |
|------|-----------|
| ae7259c | security(operacao): adicionar accessScope ao mockRequest (user-helpers) |
| 10c9e24 | fix(denuncia): corrigir 2 specs estáticos pré-baseline |
| d3dd5ac | security(operacao): migrar create, bulk-insert, enviar-equipe → requireTenantId |
| 0a43950 | security(operacao): migrar concluir-para-item, criar-para-item, ensure-em-andamento, ensure-and-concluir → requireTenantId |
| 4532a18 | security(operacao): migrar save, upsert, resolver, add-evidencia, delete → requireTenantId |
| 8490c9b | security(operacao): migrar resolver-status-item e existing-item-ids no controller |
| 3c4b275 | security(operacao): migrar get-operacao → scope.tenantId |
| ec80b89 | security(operacao): migrar read-list use-cases para AccessScope canônico |

---

## A. Endpoints migrados (19)

Legenda de scopes:
- **Municipal** — `kind: 'municipal'`, `tenantId: string`, `clienteIdsPermitidos: [string]`
- **Platform** — `kind: 'platform'`, `tenantId: string | null`, `clienteIdsPermitidos: string[] | null`
- **Admin sem ?clienteId** — Platform com `tenantId: null` e `clienteIdsPermitidos: null`

| # | Rota | Método | Use-case | Helper aplicado | Onde é chamado | Municipal | Platform c/ tenantId | Admin sem ?clienteId |
|---|------|--------|----------|-----------------|---------------|-----------|----------------------|----------------------|
| 1 | `/operacoes` | GET | FilterOperacao | `getClienteIdsPermitidos(scope)` | use-case | filtra `clienteId[0]` | filtra `clienteId[0]` | sem `WHERE cliente_id` (retorna todos os tenants) |
| 2 | `/operacoes/pagination` | GET | PaginationOperacao | `getClienteIdsPermitidos(scope)` | use-case | filtra `clienteId[0]` | filtra `clienteId[0]` | sem `WHERE cliente_id` |
| 3 | `/operacoes/stats` | GET | StatsOperacao | `getClienteIdsPermitidos(scope)` | use-case | `countByStatus('tenant-id')` | `countByStatus('tenant-id')` | `countByStatus(null)` — contagem global |
| 4 | `/operacoes/com-vinculos` | GET | ListarComVinculos | `getClienteIdsPermitidos(scope)` | use-case | `WHERE o.cliente_id = ?` no SQL raw | `WHERE o.cliente_id = ?` | sem cláusula `cliente_id` no SQL |
| 5 | `/operacoes/resolver-status-item` | POST | ResolverStatusItem | `requireTenantId(scope)` | controller | OK — usa `tenantId` | OK — usa `tenantId` | 403 Forbidden |
| 6 | `/operacoes/existing-item-ids` | POST | ListExistingItemIds | `requireTenantId(scope)` | controller | OK — usa `tenantId` | OK — usa `tenantId` | 403 Forbidden |
| 7 | `/operacoes/:id` | GET | GetOperacao | `scope.tenantId` | use-case | `findById(id, tenantId)` | `findById(id, tenantId)` | `findById(id, null)` — sem filtro de tenant |
| 8 | `/operacoes` | POST | CreateOperacao | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 9 | `/operacoes/:id` | PUT | SaveOperacao | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 10 | `/operacoes/upsert` | POST | UpsertOperacao | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 11 | `/operacoes/bulk-insert` | POST | BulkInsertOperacoes | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 12 | `/operacoes/concluir-para-item` | POST | ConcluirParaItemOperacao | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 13 | `/operacoes/ensure-em-andamento` | POST | EnsureEmAndamento | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 14 | `/operacoes/ensure-and-concluir` | POST | EnsureAndConcluir | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 15 | `/operacoes/criar-para-item` | POST | CriarParaItem | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 16 | `/operacoes/enviar-equipe` | POST | EnviarEquipe | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 17 | `/operacoes/:id/resolver` | POST | ResolverOperacao | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 18 | `/operacoes/:id/evidencias` | POST | AddEvidencia | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |
| 19 | `/operacoes/:id` | DELETE | DeleteOperacao | `requireTenantId(scope)` | use-case | OK | OK | 403 Forbidden |

**Distribuição de helpers:**
- `requireTenantId`: 15 endpoints (todos os writes + 2 reads com escopo obrigatório)
- `getClienteIdsPermitidos`: 4 endpoints (read-list e stats — suportam visão global do admin)
- `scope.tenantId`: 1 endpoint (`GET /:id` — repositório aceita `string | null`)

---

## B. Testes adicionados

4 novos testes de platform scope (1 por spec do Grupo 2). Testes pré-existentes não foram alterados.

### filter-operacao.spec.ts
**Testes pré-existentes (MunicipalScope — inalterados):**
- `deve retornar operações com clienteId sempre do tenant (MT-02)` — `clienteIds: ['tenant-uuid-1']` → `findAll({ clienteId: 'tenant-uuid-1' })`
- `deve sobrescrever clienteId do filtro com o tenantId do request` — `clienteId` do body ignorado, `clienteId[0]` do scope prevalece
- `deve retornar lista vazia quando não há operações`

**Novo teste (PlatformScope):**
- `deve chamar findAll sem clienteId quando admin sem tenant`
  - Cenário: `kind: 'platform'`, `clienteIdsPermitidos: null`
  - Assertion: `findAll({ status: 'pendente', clienteId: undefined })` — sem filtro de tenant

### pagination-operacao.spec.ts
**Testes pré-existentes (MunicipalScope — inalterados):**
- `deve repassar filtros com clienteId do tenant para findPaginated`
- `deve ignorar clienteId vindo do filtro em favor do tenant`

**Novo teste (PlatformScope):**
- `deve chamar findPaginated sem clienteId quando admin sem tenant`
  - Cenário: `kind: 'platform'`, `clienteIdsPermitidos: null`
  - Assertion: `findPaginated({ status: 'em_andamento', clienteId: undefined }, pagination)`

### stats-operacao.spec.ts
**Testes pré-existentes (MunicipalScope — inalterados):**
- `deve retornar contagens por status para o tenant atual` — `countByStatus('tenant-stats-1')`
- `deve retornar objeto vazio quando não há operações`

**Novo teste (PlatformScope):**
- `deve chamar countByStatus com null quando admin sem tenant`
  - Cenário: `kind: 'platform'`, `clienteIdsPermitidos: null`
  - Assertion: `countByStatus(null)` — contagem global de todos os tenants

### listar-com-vinculos.spec.ts
**Testes pré-existentes (MunicipalScope — inalterados):**
- `deve chamar $queryRaw com clienteId do tenant`
- `deve aplicar filtro de status quando fornecido`

**Novo teste (PlatformScope):**
- `deve chamar $queryRaw sem filtro de clienteId quando platform scope (admin)`
  - Cenário: instância criada diretamente com `clienteIdsPermitidos: null`
  - Assertion: `$queryRaw` chamado 1×; sem cláusula `o.cliente_id` no SQL (não há asserção sobre o SQL inline — a cobertura é comportamental)

---

## C. Testes ajustados mecanicamente

**Nenhum.**

A decisão de projeto foi usar `clienteIds !== null ? clienteIds[0] : undefined` em vez de `{ in: clienteIds }`, preservando a interface `clienteId?: string` do DTO `FilterOperacaoInput` e do repositório `findAll`/`findPaginated`. Nenhuma assertion existente precisou mudar de escalar para `{ in: [...] }`.

Os únicos ajustes de spec desta sessão foram 2 fixes de falhas pré-existentes no módulo `denuncia` (commit `10c9e24`), não relacionados à migração de AccessScope:

| Spec | Linha | Antes | Depois | Motivo |
|------|-------|-------|--------|--------|
| `denuncia.controller.spec.ts:46` | input | `'abc12345'` | `'sent-2026-abc123'` | Regex do controller exige `SENT-YYYY-XXXXXX`; teste precisa passar na validação |
| `denuncia.controller.spec.ts:47` | expected | `'ABC12345'` | `'SENT-2026-ABC123'` | Use-case recebe protocolo após `.toUpperCase()` |
| `denunciar-cidadao-v2.spec.ts:64` | assertion | `.toEqual('protocolo-fixo')` | `.toMatch(/^SENT-\d{4}-[A-F0-9]{6}$/)` | Protocolo é gerado dinamicamente com `randomBytes` |

---

## D. IDs de domínio em body — validação cross-tenant pendente

7 campos recebidos em body/query que não são validados contra o tenant após a migração. A migração garante que o **tenant do actor** é canônico; não garante que as **entidades referenciadas por ID** pertencem ao mesmo tenant.

| # | Campo | Endpoints | Entidade | Tabela Prisma | Risco específico |
|---|-------|-----------|----------|---------------|-----------------|
| 1 | `focoRiscoId` | `POST /operacoes`, `POST /criar-para-item`, `GET /com-vinculos` (filtro) | FocoRisco | `focos_risco` | **Cross-tenant create**: criar operação vinculada a foco de outro cliente — FK aceita silenciosamente, `operacoes.foco_risco_id` fica cross-tenant |
| 2 | `responsavelId` | `POST /operacoes`, `PUT /:id`, `POST /upsert`, `POST /enviar-equipe` | Usuario | `usuarios` | **Cross-tenant assignment**: atribuir agente/supervisor de outro cliente como responsável da operação |
| 3 | `itemLevantamentoId` | `POST /criar-para-item`, `POST /concluir-para-item`, `POST /ensure-em-andamento`, `POST /ensure-and-concluir` | LevantamentoItem | `levantamento_itens` | **Cross-tenant create/update**: criar ou concluir operação para item pertencente a outro cliente |
| 4 | `itemOperacionalId` | `POST /bulk-insert` | LevantamentoItem | `levantamento_itens` | **Cross-tenant bulk insert**: inserir lote de operações vinculadas a itens de outro cliente |
| 5 | `regiaoId` | `POST /operacoes`, `PUT /:id`, `POST /upsert` | Regiao | `regioes` | **Cross-tenant region assignment**: vincular operação a região que não pertence ao cliente |
| 6 | `id` (upsert body) | `POST /upsert` | Operacao | `operacoes` | **Mitigado**: `findById(data.id, clienteId)` filtra por tenant — retorna 404 se cross-tenant. Sem ação pendente. |
| 7 | `itemId` | `POST /resolver-status-item` | LevantamentoItem | `levantamento_itens` | **Cross-tenant resolve**: resolver foco de risco via ID de item de outro cliente; `clienteId` é passado ao use-case mas o `itemId` em si não é validado contra o tenant antes da operação |

### Caminho de validação proposto (padrão B-02)

```typescript
// focoRiscoId → validar que o foco pertence ao tenant
const foco = await focoRiscoRepository.findById(focoRiscoId);
if (!foco || foco.clienteId !== requireTenantId(scope)) throw FocoRiscoException.notFound();

// responsavelId → validar que o usuário pertence ao tenant
const usuario = await usuarioRepository.findById(responsavelId);
if (!usuario || usuario.clienteId !== requireTenantId(scope)) throw UsuarioException.notFound();

// itemLevantamentoId / itemId → validar que o item pertence ao tenant
const item = await levantamentoItemRepository.findById(itemLevantamentoId);
if (!item || item.clienteId !== requireTenantId(scope)) throw LevantamentoException.itemNotFound();

// regiaoId → validar que a região pertence ao tenant
const regiao = await regiaoRepository.findById(regiaoId);
if (!regiao || regiao.clienteId !== requireTenantId(scope)) throw RegiaoException.notFound();
```

Referência canônica: `src/shared/security/tenant-ownership.util.ts` (`assertTenantOwnership`).

**Prioridade dos campos por risco:**
- **Alta** — `focoRiscoId` (1), `itemLevantamentoId` (3), `itemId` (7): criam ou alteram registros com FKs cross-tenant; FK aceita sem 404
- **Média** — `responsavelId` (2), `regiaoId` (5): atribuição silenciosa cross-tenant
- **Baixa** — `itemOperacionalId` (4): bulk insert; menos frequente
- **Nenhuma** — `id` em upsert (6): já protegido por `findById(id, clienteId)`

---

## E. Próximo módulo

**`sla`** — confirmado como próximo na fila.

- **15 arquivos** com `req['tenantId']` identificados no inventário do Passo 1
- **Tipos esperados de mudança**: mix similar ao operacao
  - Write use-cases (create, update, close SLA) → `requireTenantId(scope)`
  - Read-list use-cases (listar SLAs por status, por cliente) → `getClienteIdsPermitidos(scope)`
  - Read single use-cases (getSla, getSlaConfig) → `scope.tenantId`
- **Baseline de entrada**: 1072 testes verdes (241 suites)
- **Não bloqueado** por nenhuma pendência do módulo operacao
