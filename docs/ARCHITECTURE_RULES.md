# Sentinella — Regras Canônicas de Arquitetura

> Este arquivo deve ser considerado fonte de verdade para auditorias automatizadas (Claude CLI, ChatGPT, etc.)
>
> Última atualização: 2026-04-30 — pós-hardening PR-01 a PR-04.

---

## ⚠️ REGRA 1 — MULTITENANCY NÃO É PADRÃO SIMPLES

Este sistema possui 3 escopos distintos:

### 1. MUNICIPAL (tenant-scoped)
- papéis: `supervisor`, `agente`, `notificador`
- possuem `cliente_id`
- acessam dados operacionais

### 2. GLOBAL (plataforma SaaS)
- papel: `admin`
- NÃO possui `cliente_id`
- NÃO acessa operação municipal
- gerencia clientes, billing, limites

### 3. REGIONAL (analítico)
- papel: `analista_regional`
- NÃO possui `cliente_id`
- usa agrupamento de clientes (`agrupamentoId`)
- acesso SOMENTE leitura/analítica

❗ IMPORTANTE:
A ausência de `cliente_id` NÃO é bug para `admin` ou `analista_regional`.

---

## ⚠️ REGRA 2 — ACCESS SCOPE É A ÚNICA FONTE DE VERDADE

- NÃO usar `req['tenantId']`
- NÃO usar `req.tenantId` diretamente
- SEMPRE usar:
  ```typescript
  getAccessScope(req)      // src/shared/security/access-scope.ts
  requireTenantId(scope)   // lança ForbiddenException se tenantId === null
  ```
- `req['tenantId']` e `req.user.isPlatformAdmin` são legados removidos — não existem mais em runtime.

---

## ⚠️ REGRA 3 — IDOR E CLIENTE_ID

- Toda entidade municipal DEVE usar `cliente_id` no WHERE
- EXCEÇÃO: entidades de plataforma (`auth`, `refresh_tokens`, `usuarios`, etc.)
- O padrão correto é `findById(id, clienteId?)` — repositórios filtram por `cliente_id` quando `clienteId` é fornecido
- Use-cases DEVEM passar `tenantId` no `findById`; não confiar em asserts a posteriori

---

## ⚠️ REGRA 4 — DRONE É RECURSO DE PLATAFORMA

O módulo `drone`:

- NÃO pertence a tenant
- NÃO possui `cliente_id`
- NÃO deve usar `assertTenantOwnership`
- É controlado por papel (ex: `admin`)

❗ IMPORTANTE:
NÃO marcar ausência de `cliente_id` no módulo `drone` como vulnerabilidade IDOR.
O controle de acesso é por `@Roles('admin')`, o que é correto para recurso de plataforma.

---

## ⚠️ REGRA 5 — SUPABASE NÃO É MAIS USADO

- Sistema roda 100% em PostgreSQL próprio (self-hosted)
- Migração concluída em 2026-04-20 (Fase 6 de 6)
- `auth.guard.ts` usa **somente** `SECRET_JWT` — `audience: 'sentinella-api'`, `issuer: 'sentinella-auth'`
- `SUPABASE_JWT_SECRET` **não existe** em `server.ts` (Zod schema) — nunca foi lido em runtime
- `@supabase/supabase-js` **não está** em nenhum `package.json` de runtime
- Qualquer referência restante a "Supabase" em código ou docs é legado/documentação histórica
- NÃO existe integração runtime com Supabase
- Storage: Cloudinary. Auth: JWT HS256 próprio. Edge Functions: `@nestjs/schedule`.

---

## ⚠️ REGRA 6 — NÃO INVENTAR PADRÕES

Auditorias devem:
- validar código real — ler os arquivos antes de concluir
- NÃO assumir padrão genérico de SaaS
- NÃO aplicar regra de "todo endpoint precisa de tenant" — admin e analista_regional são exceções legítimas
- NÃO reportar como IDOR a ausência de `cliente_id` em rotas explicitamente restritas por `@Roles('admin')`
- NÃO reportar Supabase como risco ativo — a integração não existe em runtime
- Verificar `src/lib/env/server.ts` (Zod schema) como fonte de verdade das variáveis de ambiente lidas pelo app

---

## ⚠️ REGRA 7 — ADMIN E REGIONAL NÃO SÃO TENANT

- `admin` ≠ tenant — não possui `cliente_id`, seleciona contexto via `?clienteId=xxx`
- `analista_regional` ≠ tenant — possui `agrupamentoId`, acessa múltiplos clientes em leitura
- NÃO forçar `cliente_id` nesses fluxos
- `TenantGuard` é global, mas opt-out via `@SkipTenant()` é legítimo para rotas de plataforma
- `@Public()` desabilita AuthGuard — usar apenas em rotas verdadeiramente públicas (ex: `/denuncias/cidadao`)

---

## Referências de implementação

| Conceito | Arquivo |
|---|---|
| AccessScope (discriminated union) | `src/shared/security/access-scope.ts` |
| getAccessScope / requireTenantId | `src/shared/security/access-scope.ts` |
| assertTenantOwnership | `src/shared/security/tenant-ownership.util.ts` |
| AuthGuard | `src/guards/auth.guard.ts` |
| TenantGuard | `src/guards/tenant.guard.ts` |
| RolesGuard | `src/guards/roles.guard.ts` |
| Env schema (Zod) | `src/lib/env/server.ts` |
| Drone (plataforma) | `src/modules/drone/` |
