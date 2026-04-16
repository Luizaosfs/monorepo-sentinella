# Testes — unitários (Vitest) e E2E (Playwright)

## Comandos locais

| Comando | Descrição |
|---------|-----------|
| `npm test` | Vitest (unitário), rápido — **sem** cobertura. |
| `npm run test:ci` | Vitest com `--coverage` e thresholds (é o que o CI executa). |
| `npm run test:coverage` | Igual a `test:ci` + relatório HTML em `coverage/`. |
| `npm run test:e2e` | Playwright — todos os projetos (Chromium, Firefox, WebKit). |
| `npm run test:e2e:smoke` | Apenas testes com tag `@smoke`, Chromium. Rápido para validar ambiente. |
| `npm run test:e2e:chromium` | Suite completa só no Chromium. |
| `npm run test:e2e:ci-full` | Usado no workflow agendado `e2e-full.yml` (Chromium, suite completa). |

## Cobertura unitária (Vitest)

- O denominador de cobertura **não inclui** `src/pages/**` nem `src/components/**`, para refletir código com maior prioridade de testes (libs, serviços, hooks, tipos).
- Thresholds atuais estão em [`vitest.config.ts`](../vitest.config.ts) (`coverage.thresholds`). Subir gradualmente após `npm run test:coverage`.
- Prioridades para novos testes: [`src/services/api.ts`](../src/services/api.ts) (sempre validar `cliente_id` onde aplicável), [`src/lib/`](../src/lib/), hooks em [`src/hooks/`](../src/hooks/).

## E2E — variáveis (`.env.e2e`)

Na raiz do repositório, crie **`.env.e2e`** (não commitar segredos). O Playwright carrega esse arquivo em [`playwright.config.ts`](../playwright.config.ts); o Vite em modo `e2e` também usa esses valores.

Variáveis típicas:

- `VITE_SUPABASE_URL` — URL do projeto Supabase usado nos testes.
- `VITE_SUPABASE_ANON_KEY` — chave anon do mesmo projeto.

Credenciais por fluxo (quando o spec precisar de login real), por exemplo:

- `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`
- `TEST_OPERADOR_EMAIL` / `TEST_OPERADOR_PASSWORD`
- `TEST_NOTIF_EMAIL` / `TEST_NOTIF_PASSWORD`
- `TEST_SUPERVISOR_EMAIL` / `TEST_SUPERVISOR_PASSWORD`
- `TEST_ADMIN_B_EMAIL` / `TEST_ADMIN_B_PASSWORD` — segundo tenant (cross-tenant), usado em [`e2e/p1-security-regression.spec.ts`](../e2e/p1-security-regression.spec.ts) e similares.

Muitos specs usam `test.skip(...)` quando as variáveis não estão definidas — isso é esperado em desenvolvimento local parcial.

### Specs sensíveis a dados

- [`e2e/seguranca-cross-tenant.spec.ts`](../e2e/seguranca-cross-tenant.spec.ts), [`e2e/multitenancy-rls.spec.ts`](../e2e/multitenancy-rls.spec.ts), [`e2e/p1-security-regression.spec.ts`](../e2e/p1-security-regression.spec.ts): exigem usuários e, em alguns casos, dois clientes distintos. O banco de testes deve estar alinhado (RLS, papéis, `cliente_id`).

## CI (GitHub Actions)

### Job `validate` ([`ci.yml`](../.github/workflows/ci.yml))

Sempre executa: TypeScript (`tsc`), `npm test` (Vitest), `npm run build`.

### Job `e2e-smoke` (opcional)

- Só roda se a **variável de repositório** `E2E_CI_ENABLED` estiver definida como `true` (Settings → Secrets and variables → Actions → Variables).
- Em PRs de **forks**, o job é ignorado (não há secrets do repositório base).
- Requer **secrets**: `E2E_VITE_SUPABASE_URL`, `E2E_VITE_SUPABASE_ANON_KEY`.
- Executa `npm run test:e2e:smoke` (testes com tag `@smoke`).

### Workflow [`e2e-full.yml`](../.github/workflows/e2e-full.yml)

- Disparo: **semanal** (segundas 05:00 UTC) e **manual** (`workflow_dispatch`).
- Mesma flag `E2E_CI_ENABLED` e os mesmos secrets.
- Executa a suite completa no Chromium (`npm run test:e2e:ci-full`).

## Tags Playwright

- `@smoke` — fluxos mínimos (ex.: login renderiza formulário, 404). Usados no CI quando `e2e-smoke` está habilitado.
- Para marcar um teste: `test('nome', { tag: '@smoke' }, async ({ page }) => { ... })`.
