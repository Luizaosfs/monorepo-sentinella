# AUDITORIA FINAL — Pós-correção: Gestão de Usuários e Permissões

**Período das correções:** 2026-09-10 a 2026-09-24
**Migration principal:** `20260924000000_fix_rls_usuarios_papeis.sql`
**Auditoria gerada em:** 2026-04-02

---

## Escopo da auditoria

1. Gestão de usuários (RLS em `usuarios`)
2. Permissões por papel (RLS em `papeis_usuarios`, `papel_permitido_para_supervisor`)
3. Acesso por rotas (guards em `App.tsx`)
4. Criação de usuário (Edge Function `criar-usuario`)
5. Isolamento multi-tenant (cross-tenant isolation)

Validação baseada em: código-fonte, SQL, policies, Edge Function e rotas reais.
Nenhuma afirmação inventada — tudo rastreável aos arquivos referenciados.

---

## Resumo executivo

As correções aplicadas **blindaram** efetivamente os 5 vetores identificados.
O sistema está em estado seguro para operação. Um ponto residual cosmético foi identificado
sem impacto em segurança.

---

## 1. Gestão de usuários — `usuarios`

**Problema original:** `is_operador()` nas policies SELECT/INSERT/UPDATE permitia que operador
listasse, criasse e editasse usuários do cliente.

**Correção aplicada:** `is_operador()` removida das 3 policies. Policies legadas redundantes
dropadas (eliminação de expansão por semântica OR).

**Estado atual:**

| Operação | admin | supervisor | operador | notificador |
|----------|-------|------------|----------|-------------|
| SELECT (outros usuários) | ✅ | ✅ (só cliente) | ❌ | ❌ |
| INSERT   | ✅ | ✅ (só cliente) | ❌ | ❌ |
| UPDATE (outros usuários) | ✅ | ✅ (só cliente) | ❌ | ❌ |
| DELETE   | ✅ | ✅ (só cliente) | ❌ | ❌ |

**Resultado:** ✅ CORRIGIDO

---

## 2. Permissões por papel — `papeis_usuarios`

**Problema original:** Policy FOR ALL "Admins gerenciam todos os papeis" combinada por OR
com policies por-operação podia expandir acesso. Sem restrição explícita de escopo para supervisor.

**Correção aplicada:**
- Policy FOR ALL dropada e substituída por 4 policies por-operação (SELECT/INSERT/UPDATE/DELETE)
- `papel_permitido_para_supervisor()` reescrita: apenas `'operador'` e `'notificador'`
- Funções `operador_pode_gerir_usuario()` e `papel_permitido_para_operador()` dropadas

**Estado atual:**

| Operação | admin | supervisor | operador | notificador |
|----------|-------|------------|----------|-------------|
| SELECT (papéis alheios) | ✅ | ✅ (só cliente) | ❌ | ❌ |
| INSERT papel admin/supervisor | ✅ | ❌ | ❌ | ❌ |
| INSERT papel operador/notificador | ✅ | ✅ (só cliente) | ❌ | ❌ |
| UPDATE (com restrição de papel) | ✅ | ✅ (limitado) | ❌ | ❌ |
| DELETE | ✅ | ✅ (só cliente) | ❌ | ❌ |

**Resultado:** ✅ CORRIGIDO

---

## 3. Acesso por rotas

**Problema original:** Não havia separação clara entre rotas acessíveis por operador vs
rotas de gestão. Potencial para acesso indevido a `/admin/*` ou `/operador/usuarios`.

**Correção verificada (guards em App.tsx):**

| Área                    | Guard utilizado          | Operador tem acesso? |
|-------------------------|--------------------------|----------------------|
| `/admin/*`              | `AdminGuard`             | ❌                   |
| `/admin/clientes` etc.  | `PlatformAdminGuard`     | ❌                   |
| `/operador/usuarios`    | `AdminOrSupervisorGuard` | ❌                   |
| `/gestor/*`             | `AdminOrSupervisorGuard` | ❌                   |
| `/notificador/*`        | `NotificadorGuard`       | ❌                   |
| `/agente/*`             | `OperadorGuard`          | ✅                   |
| `/operador/*` (field)   | `OperadorGuard`          | ✅                   |

Supervisor redirecionado para `/gestor/central` ao tentar rotas `PlatformAdminGuard`. ✅

**Resultado:** ✅ CORRIGIDO

---

## 4. Criação de usuário — Edge Function `criar-usuario`

**Problema original:** Risco de frontend bypassing — criação direta via `auth.signUp()` ou
exposição de `service_role key`.

**Correção verificada:**
- Frontend usa exclusivamente `supabase.functions.invoke('criar-usuario', ...)`
- Edge Function verifica papel via `get_meu_papel()` (SECURITY DEFINER — não forjável)
- Dois clientes distintos: `callerClient` (anon+JWT) e `adminClient` (service_role)
- `service_role key` nunca exposta ao frontend
- Verificação de scope do supervisor: `eu.cliente_id !== cliente_id` → 403
- Supervisor bloqueado de criar `admin`, `supervisor`, `moderador`
- Rollback automático em falha de inserção (sem usuários órfãos)

**Resultado:** ✅ CORRIGIDO

---

## 5. Isolamento multi-tenant

**Problema original:** Potencial para supervisor de cliente A acessar dados do cliente B.

**Correção verificada — 3 camadas independentes:**

| Camada | Mecanismo | Garantia |
|--------|-----------|----------|
| RLS `usuarios` SELECT | `cliente_id = usuario_cliente_id()` | Zero rows de outro cliente |
| RLS `usuarios` INSERT | `cliente_id = usuario_cliente_id()` | Inserção rejeitada |
| RLS `papeis_usuarios` SELECT | `supervisor_pode_gerir_usuario()` | Zero rows de outro cliente |
| Edge Function | `eu.cliente_id !== cliente_id` → 403 | Criação rejeitada |

Ataque cross-tenant bloqueado independentemente em banco (RLS) e aplicação (Edge Function).
Um bypass em uma camada não compromete as demais. ✅

**Resultado:** ✅ CORRIGIDO

---

## 6. Papéis legados e inválidos

**Problema original:** `'usuario'` e `platform_admin` eram valores que poderiam gerar
comportamento inesperado se presentes em registros do banco.

**Correção verificada:**
- `normalizePapel('usuario')` → `null` (sem acesso a qualquer rota)
- `normalizePapel('platform_admin')` → `null` (sem acesso)
- `'moderador'` → `'supervisor'` (alias retrocompatível)
- `is_platform_admin()` dropada
- Tipo `PapelUsuario` no frontend não inclui `'usuario'`

**Resultado:** ✅ CORRIGIDO

---

## 7. Pontos residuais

### 7.1 Fallback `'usuario'` em display map (cosmético)

**Arquivo:** `src/pages/admin/AdminUsuarios.tsx`, linha 119
```ts
papelMap.get(u.auth_id ?? '') ?? 'usuario'
```

**Impacto:** Apenas visual — exibe texto `"usuario"` na coluna Papel quando chave não existe no mapa.
Não cria usuário, não afeta RLS, não bypassa guards.
**Severidade:** Cosmética.
**Ação recomendada:** Substituir por `'—'` ou `'sem papel'` para clareza de UI.

---

## 8. Quadro consolidado

| Domínio                            | Antes          | Depois         |
|------------------------------------|----------------|----------------|
| RLS `usuarios` — operador lê outros| ❌ Vulnerável  | ✅ Bloqueado   |
| RLS `usuarios` — operador insere   | ❌ Vulnerável  | ✅ Bloqueado   |
| RLS `papeis_usuarios` — ALL policy | ⚠️ Ambígua    | ✅ Por-operação |
| Supervisor atribui papel elevado   | ❌ Possível    | ✅ Bloqueado   |
| Operador acessa /admin/*           | ❌ Possível    | ✅ Bloqueado   |
| Supervisor cross-tenant            | ❌ Possível    | ✅ Bloqueado   |
| Edge Function verifica scope       | ❌ Incompleta  | ✅ Completa    |
| Papéis legados tratados            | ⚠️ Retornavam `'usuario'` | ✅ Retornam `null` |
| Funções de operador no banco       | ⚠️ Existiam    | ✅ Dropadas    |

---

## 9. Conclusão

O sistema está **seguro** nos 5 vetores auditados. As correções da migration
`20260924000000_fix_rls_usuarios_papeis.sql` e os ajustes correspondentes em
`src/hooks/useAuth.tsx` e `src/pages/admin/AdminUsuarios.tsx` eliminaram todos os
vetores de acesso indevido identificados.

O único ponto residual é cosmético (label de display) e não afeta segurança.

**Documentos de detalhe:**
- `VALIDACAO_RLS_USUARIOS.md`
- `VALIDACAO_RLS_PAPEIS_USUARIOS.md`
- `VALIDACAO_EDGE_FUNCTION_CRIAR_USUARIO.md`
- `VALIDACAO_ROTAS_POS_CORRECAO.md`
- `VALIDACAO_PAPEIS_LEGADOS_E_INVALIDOS.md`
- `VALIDACAO_MULTITENANT_USUARIOS.md`
