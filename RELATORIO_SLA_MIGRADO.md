# Relatório de migração — módulo sla
# req['tenantId'] → AccessScope

## Data
29/04/2026

## Commits

| Hash | Descrição |
|------|-----------|
| 00f9851 | feat(sla): add tests and pagination to SLA use-cases (C1 — list-sla, pagination-sla) |
| f7297b9 | security(sla): migrar count-pendentes, get-config e get-foco-config para AccessScope (C2) |
| 2de3923 | security(sla): migrar save-config, save-foco-config e upsert-config-regiao para requireTenantId (C3) |
| e7be512 | security(sla): migrar list-feriados, create-feriado e ajustar delete-feriado.spec para AccessScope (C4) |
| fbad8a7 | security(sla): migrar list-sla-painel, list-erros-criacao e list-config-regioes para requireTenantId (C5) |
| (hash TBD) | security(sla): migrar sla.controller para AccessScope (12 linhas) (C6 — pendente commit) |

---

## A. Endpoints migrados (26)

Legenda de scopes:
- **Municipal** — `kind: 'municipal'`, `tenantId: string`, `clienteIdsPermitidos: [string]`
- **Platform c/ tenantId** — `kind: 'platform'`, `tenantId: string`, `clienteIdsPermitidos: string[]`
- **Admin sem ?clienteId** — Platform com `tenantId: null` e `clienteIdsPermitidos: null`

| # | Rota | Método | Use-case / Handler | Helper aplicado | Onde | Municipal | Platform c/ tenantId | Admin sem ?clienteId |
|---|------|--------|--------------------|-----------------|------|-----------|----------------------|----------------------|
| 1 | `/sla/iminentes` | GET | ListSlaIminentes | `requireTenantId` | controller | `clienteId` literal | `clienteId` literal | 403 Forbidden |
| 2 | `/sla` | GET | ListSla | `getClienteIdsPermitidos` | use-case | filtra `clienteId[0]` | filtra `clienteId[0]` | sem `WHERE cliente_id` (retorna todos os tenants) |
| 3 | `/sla/pagination` | GET | PaginationSla | `getClienteIdsPermitidos` | use-case | filtra `clienteId[0]` | filtra `clienteId[0]` | sem `WHERE cliente_id` |
| 4 | `/sla/painel` | GET | ListSlaPainel | `requireTenantId` | use-case | `clienteId` literal | `clienteId` literal | 403 Forbidden |
| 5 | `/sla/pendentes/count` | GET | CountPendentes | `getClienteIdsPermitidos` → null-safe | use-case | `countPendentes('tenant-id')` | `countPendentes('tenant-id')` | `countPendentes(null)` — contagem global |
| 6 | `/sla/:id/status` | PATCH | UpdateSlaStatus | `scope.tenantId` | controller | `tenantId = 'tenant-id'` | `tenantId = 'tenant-id'` | `tenantId = null` → use-case trata |
| 7 | `/sla/:id/escalar` | POST | EscalarSla | `requireTenantId` | controller | `tenantId` literal | `tenantId` literal | 403 Forbidden |
| 8 | `/sla/:id/reabrir` | POST | ReabrirSla | `scope.tenantId` | controller | `tenantId = 'tenant-id'` | `tenantId = 'tenant-id'` | `tenantId = null` → use-case trata |
| 9 | `/sla/:id/concluir` | POST | ConcluirSla | `scope.tenantId` | controller | `tenantId = 'tenant-id'` | `tenantId = 'tenant-id'` | `tenantId = null` → use-case trata |
| 10 | `/sla/:id/atribuir` | PATCH | AtribuirAgente | `scope.tenantId` | controller | `tenantId = 'tenant-id'` | `tenantId = 'tenant-id'` | `tenantId = null` → use-case trata |
| 11 | `/sla/config` | GET | GetConfig | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 12 | `/sla/config` | PUT | SaveConfig | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 13 | `/sla/config/regioes` | GET | ListConfigRegioes | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 14 | `/sla/config/regioes/:regiaoId` | PUT | UpsertConfigRegiao | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 15 | `/sla/feriados` | GET | ListFeriados | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 16 | `/sla/feriados` | POST | CreateFeriado | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 17 | `/sla/feriados/:id` | DELETE | DeleteFeriado | `assertTenantOwnership` (sem mudança — já AccessScope-aware) | use-case | OK | OK | 403 Forbidden |
| 18 | `/sla/foco-config` | GET | GetFocoConfig | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 19 | `/sla/foco-config` | PUT | SaveFocoConfig | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 20 | `/sla/erros` | GET | ListErrosCriacao | `requireTenantId` | use-case | OK | OK | 403 Forbidden |
| 21 | `/sla/feriados/seed-nacionais` | POST | inline `$executeRaw` | `requireTenantId` | controller | OK | OK | 403 Forbidden |
| 22 | `/sla/config/regioes/:regiaoId` | DELETE | inline `$executeRaw` | `requireTenantId` | controller | OK | OK | 403 Forbidden |
| 23 | `/sla/config/audit` | GET | inline `$queryRaw` | `requireTenantId` | controller | OK | OK | 403 Forbidden |
| 24 | `/sla/inteligente` | GET | GetFocosRiscoAtivos.executeAll | `requireTenantId` | controller | OK | OK | 403 Forbidden |
| 25 | `/sla/inteligente/criticos` | GET | GetFocosRiscoAtivos.executeVencidos | `requireTenantId` | controller | OK | OK | 403 Forbidden |
| 26 | `/sla/inteligente/foco/:focoId` | GET | GetFocosRiscoAtivos.executeById | `requireTenantId` | controller | OK | OK | 403 Forbidden |

**Distribuição de helpers:**
- `requireTenantId`: 18 endpoints (1,4,7,11,12,13,14,15,16,18,19,20,21,22,23,24,25,26)
- `getClienteIdsPermitidos`: 3 endpoints (2,3,5 — leituras que suportam visão global do admin)
- `scope.tenantId`: 4 endpoints (6,8,9,10 — repositório aceita `string | null`)
- `assertTenantOwnership` (sem mudança): 1 endpoint (17 — já AccessScope-aware desde B-04)

**Nota #7 preservada:** endpoints 2,3,5 usam `clienteIds[0]` em vez de `{ in: clienteIds }` (mesma razão que operacao — nenhum endpoint do sla inclui `analista_regional` em `@Roles`). Se analista_regional for adicionado no futuro, migrar para `{ in: clienteIds }`.

---

## B. Testes adicionados

27 testes novos no total (baseline entrada: 1072 → saída: 1099).

### list-sla.spec.ts (C1 — novo, 3 testes)
- `deve retornar SLAs com clienteId do tenant (MT-02)` — Municipal: `clienteId[0]` passado ao repo
- `deve sobrescrever clienteId do filtro com o tenantId do request` — Municipal: filtro do body ignorado
- `deve chamar findAll sem clienteId quando admin sem tenant` — Platform: `clienteId: undefined`

### pagination-sla.spec.ts (C1 — novo, 3 testes)
- `deve repassar filtros com clienteId do tenant para findPaginated` — Municipal
- `deve ignorar clienteId do filtro em favor do tenant` — Municipal
- `deve chamar findPaginated sem clienteId quando admin sem tenant` — Platform: `clienteId: undefined`

### count-pendentes.spec.ts (C2 — novo, 2 testes)
- `deve contar pendentes com clienteId do tenant` — Municipal: `countPendentes('test-cliente-id')`
- `deve chamar countPendentes com null quando admin sem tenant` — Platform: `countPendentes(null)` — **não** ForbiddenException; plataforma tem visão global de pendentes

### get-config.spec.ts (C2 — novo, 3 testes)
- `deve retornar config existente com clienteId do tenant` — Municipal: repo retorna config existente
- `deve retornar config default quando não existe config` — Municipal: `findConfig` retorna null → default `{ clienteId, config: {} }`
- `deve lançar ForbiddenException quando admin sem tenant` — Platform: `requireTenantId` → 403

### get-foco-config.spec.ts (C2 — novo, 2 testes)
- `deve listar foco configs com clienteId do tenant` — Municipal
- `deve lançar ForbiddenException quando admin sem tenant` — Platform

### upsert-config-regiao.spec.ts (C3 — novo, 2 testes)
- `deve chamar upsertConfigRegiao com clienteId do tenant` — Municipal: `upsertConfigRegiao('tenant-regiao-1', 'regiao-uuid-1', config)` + `{ updated: true }`
- `deve lançar ForbiddenException quando admin sem tenant` — Platform

### list-feriados.spec.ts (C4 — novo, 2 testes)
- `deve listar feriados com clienteId do tenant` — Municipal: `findFeriados('test-cliente-id')`
- `deve lançar ForbiddenException quando admin sem tenant` — Platform

### list-sla-painel.spec.ts (C5 — novo, 3 testes)
- `deve listar painel com clienteId do tenant` — Municipal: `findPainel('test-cliente-id', undefined)`
- `deve repassar agenteId ao repositório` — Municipal: `findPainel('test-cliente-id', 'agente-uuid-1')`
- `deve lançar ForbiddenException quando admin sem tenant` — Platform

### list-erros-criacao.spec.ts (C5 — novo, 2 testes)
- `deve listar erros de criação com clienteId do tenant` — Municipal: `findErrosCriacao('test-cliente-id', 20)`
- `deve lançar ForbiddenException quando admin sem tenant` — Platform

### list-config-regioes.spec.ts (C5 — novo, 2 testes)
- `deve listar config de regiões com clienteId do tenant` — Municipal: `findConfigRegioes('test-cliente-id')`
- `deve lançar ForbiddenException quando admin sem tenant` — Platform

---

## C. Testes ajustados

4 specs modificados por adição de cenário platform ou migração de mock.

| Spec | Tipo de ajuste | Hunks |
|------|---------------|-------|
| `save-config.spec.ts` | Adicionado `import { ForbiddenException }` + `describe('com platform scope')` com 1 teste de 403 | 2 hunks |
| `save-foco-config.spec.ts` | Idem | 2 hunks |
| `create-feriado.spec.ts` | Idem | 2 hunks |
| `delete-feriado.spec.ts` | Migração completa: `const req: any = { user: { isPlatformAdmin: true }, tenantId: null }` → `mockRequest({ accessScope: { kind: 'platform', ... } })` + mutações `req['accessScope']` por teste; adicionado import `mockRequest` | 3 hunks |

---

## D. IDs de domínio em body — validação cross-tenant pendente

3 campos recebidos em parâmetro/body que não são validados contra o tenant após a migração. A migração garante que o **tenant do actor** é canônico; não garante que as **entidades referenciadas por ID** pertencem ao mesmo tenant.

| # | Campo | Endpoints | Entidade | Tabela Prisma | Risco específico |
|---|-------|-----------|----------|---------------|-----------------|
| 1 | `agenteId` | `PATCH /sla/:id/atribuir` | Usuario | `usuarios` | **Cross-tenant assignment**: `AtribuirAgente` seta `sla.agente_id = data.agenteId` sem buscar o agente nem validar `agente.clienteId === tenantId`; FK aceita silenciosamente — padrão idêntico aos campos B-02 do operacao |
| 2 | `focoId` (param) | `GET /sla/inteligente/foco/:focoId` | FocoRisco | `focos_risco` | **Cross-tenant read**: `executeById(focoId, clienteId)` filtra por `foco_risco_id = focoId`, mas a cláusula `WHERE cliente_id = clienteId` está no raw SQL — validar que a combinação retorna vazio (404) e não silencia erro cross-tenant |
| 3 | `regiaoId` (param) | `PUT /sla/config/regioes/:regiaoId`, `DELETE /sla/config/regioes/:regiaoId` | Regiao | `regioes` | **Cross-tenant upsert/delete**: regiaoId é uuid passado diretamente ao SQL sem verificar que `regioes.cliente_id === tenantId`; admin poderia sobrescrever config de região de outro tenant |

### Caminho de validação proposto

```typescript
// agenteId → buscar agente e validar tenant
const agente = await usuarioRepository.findById(agenteId);
if (!agente || agente.clienteId !== clienteId) throw SlaException.agenteNotFound();

// regiaoId → buscar região e validar tenant
const regiao = await regiaoRepository.findById(regiaoId);
if (!regiao || regiao.clienteId !== clienteId) throw RegiaoException.notFound();
```

Referência canônica: `src/shared/security/tenant-ownership.util.ts`.

**Pendência #8 do PENDENCIAS_HARDENING.md cobre agenteId detalhadamente.**

---

## E. Próximo módulo

**`dashboard`** — confirmado como próximo na fila.

- **13 arquivos** com `req['tenantId']` identificados no inventário inicial
- **Tipos esperados de mudança**: mix de `requireTenantId` (dashboards executivo, piloto, regional) e `getClienteIdsPermitidos` (analytics globais acessíveis a admin sem tenant)
- **Baseline de entrada**: 1099 testes verdes (251 suites)
- **Não bloqueado** por nenhuma pendência do módulo sla
