# Papéis Canônicos — Sentinella

> Documento oficial. Elimina ambiguidade entre banco, auth, frontend e UI.
> Última revisão: 2026-04-10

---

## Papéis persistidos no banco (`enum papel_app`)

| Papel | Descrição | `cliente_id` |
|---|---|---|
| `admin` | Dono do SaaS — acesso cross-tenant irrestrito | **não** (global) |
| `supervisor` | Gestor da prefeitura — acesso ao portal /gestor/* | **sim** |
| `operador` | Agente de campo — acesso ao portal /operador/* e /agente/* | **sim** |
| `notificador` | Funcionário UBS/posto — acesso ao portal /notificador/* | **sim** |

Alias histórico aceito pelo banco: `moderador` → tratado como `supervisor`.

Valores mortos (nunca atribuir): `platform_admin`, `usuario`, `cliente`.

---

## Aliases de UI (NÃO persistidos)

| Alias de UI | Papel real no banco | Onde aparece |
|---|---|---|
| `gestor` | `supervisor` | Rotas `/gestor/*`, labels, menus |
| `agente` | `operador` | Rotas `/agente/*`, labels, menus |

**Regra:** `gestor` e `agente` são nomes amigáveis para o usuário final.
Nunca devem aparecer em:
- `enum papel_app` no banco
- `PapelApp` em `src/types/database.ts`
- `normalizePapel()` em `src/hooks/useAuth.tsx`
- Queries SQL (`WHERE papel = 'gestor'`)
- Filtros de API (`CAMP = new Set(['agente', ...])`)

---

## Onde cada camada usa cada conceito

| Camada | Usa papéis canônicos | Pode usar aliases de UI |
|---|---|---|
| Banco (`papeis_usuarios`) | ✅ sempre | ❌ nunca |
| RLS / funções SQL | ✅ sempre | ❌ nunca |
| JWT / `app_metadata` | ✅ sempre | ❌ nunca |
| `useAuth.tsx` — `normalizePapel` | ✅ sempre | ❌ nunca |
| `useAuth.tsx` — flags (`isAdmin`, etc.) | ✅ sempre | ❌ nunca |
| `src/types/database.ts` — `PapelApp` | ✅ sempre | ❌ nunca |
| `src/services/api.ts` — filtros | ✅ sempre | ❌ nunca |
| `src/lib/labels.ts` — display | ✅ canônicos + | ✅ aliases para exibição |
| Rotas React (`/gestor/*`, `/agente/*`) | — | ✅ nomes de rota apenas |
| Textos de UI, tooltips, menus | — | ✅ livre |

---

## Hierarquia de prioridade (quando usuário tem múltiplos papéis)

```
admin (5) > supervisor / moderador (4) > operador (3) > notificador (2)
```

Definida em:
- Frontend: `ROLE_PRIORITY` em `src/hooks/useAuth.tsx`
- Banco: `ORDER BY CASE` em `get_meu_papel()` e `custom_access_token_hook`

---

## Referências de código

| Conceito | Arquivo |
|---|---|
| Tipo TypeScript canônico | `src/types/database.ts` → `PapelApp` |
| Normalização auth | `src/hooks/useAuth.tsx` → `normalizePapel()` |
| Labels de exibição | `src/lib/labels.ts` → `PAPEL_LABEL`, `getPapelLabel()` |
| Normalização display | `src/lib/labels.ts` → `normalizarPapel()` |
| Função SQL | `public.get_meu_papel()` |
| JWT enrichment | `public.custom_access_token_hook()` |
| Guards de rota | `src/guards/` |
