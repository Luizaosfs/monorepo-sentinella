# VALIDAÇÃO — RLS da tabela `usuarios`

**Migration de referência:** `supabase/migrations/20260924000000_fix_rls_usuarios_papeis.sql`
**Data da correção:** 2026-09-24
**Validado em:** 2026-04-02

---

## 1. Problema corrigido

Antes da correção, as policies `usuarios_select`, `usuarios_insert` e `usuarios_update` incluíam
a função `is_operador()` nas cláusulas USING/WITH CHECK. Isso permitia que qualquer usuário
com papel `operador` listasse, criasse e editasse usuários do mesmo cliente — violando o
princípio de menor privilégio.

Adicionalmente, existiam policies legadas redundantes (criadas por migrations iniciais) que,
por semântica OR do PostgreSQL, expandiam o acesso de forma não intencional.

---

## 2. Estado atual das policies (pós-correção)

### 2.1 `usuarios_select`

```sql
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );
```

| Papel       | Pode listar outros usuários? | Base da permissão                      |
|-------------|------------------------------|----------------------------------------|
| admin       | Sim — todos                  | `is_admin()`                           |
| supervisor  | Sim — do próprio cliente     | `is_supervisor() AND cliente_id match` |
| operador    | **Não** — somente próprio row | `auth_id = auth.uid()`                |
| notificador | **Não** — somente próprio row | `auth_id = auth.uid()`                |

**`is_operador()` removida.** ✅

---

### 2.2 `usuarios_insert`

```sql
CREATE POLICY "usuarios_insert" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );
```

| Papel       | Pode inserir usuário? |
|-------------|-----------------------|
| admin       | Sim                   |
| supervisor  | Sim — no próprio cliente |
| operador    | **Não**               |
| notificador | **Não**               |

**`is_operador()` removida.** ✅

---

### 2.3 `usuarios_update`

```sql
CREATE POLICY "usuarios_update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );
```

| Papel       | Pode editar outros usuários? |
|-------------|------------------------------|
| admin       | Sim                          |
| supervisor  | Sim — do próprio cliente     |
| operador    | **Não**                      |
| notificador | **Não**                      |

Nota: a policy `usuarios_update_own` (permite ao próprio usuário editar seu row via `auth_id = auth.uid()`)
foi **mantida**, garantindo que cada usuário possa atualizar dados do próprio perfil.

**`is_operador()` removida.** ✅

---

### 2.4 `usuarios` — DELETE

Não alterada nesta migration. Requer `is_admin()` ou `supervisor_pode_gerir_usuario()`. Operador nunca teve acesso a DELETE.

---

## 3. Policies legadas dropadas

| Policy removida                        | Motivo                                          |
|----------------------------------------|-------------------------------------------------|
| "Admins atualizam usuarios"            | Substituída pela `usuarios_update` corrigida    |
| "Admins deletam usuarios"              | Sem alteração necessária — mantida logicamente  |
| "Admins inserem usuarios"              | Substituída pela `usuarios_insert` corrigida    |
| "Usuarios veem seu proprio perfil"     | Redundante com `usuarios_select`                |
| "usuarios_select_own"                  | Redundante com `usuarios_select`                |

Eliminação das policies redundantes remove o risco de expansão de acesso por semântica OR. ✅

---

## 4. Isolamento multi-tenant na SELECT/INSERT/UPDATE

- SELECT supervisor: `cliente_id = public.usuario_cliente_id()` — supervisor só vê usuários do próprio cliente.
- INSERT supervisor: `cliente_id = public.usuario_cliente_id()` — supervisor só insere no próprio cliente.
- UPDATE supervisor: `cliente_id = public.usuario_cliente_id()` — supervisor só edita no próprio cliente.

Nenhuma dessas condições permite leitura cruzada entre clientes. ✅

---

## 5. Ponto de atenção residual (baixo risco)

**Arquivo:** `src/pages/admin/AdminUsuarios.tsx`, linha 119

```ts
papelMap.get(u.auth_id ?? '') ?? 'usuario'
```

O fallback `'usuario'` é uma string de display utilizada quando o mapa de papéis não contém
a chave do usuário. Não corresponde a nenhuma atribuição de papel no banco nem bypassa nenhuma
policy RLS. Impacto: **apenas visual**, exibe texto `"usuario"` na coluna Papel da tabela.

**Classificação:** cosmético / baixo risco. Não afeta segurança.

---

## 6. Resultado

| Verificação                                         | Status  |
|-----------------------------------------------------|---------|
| `is_operador()` removido de `usuarios_select`       | ✅ OK   |
| `is_operador()` removido de `usuarios_insert`       | ✅ OK   |
| `is_operador()` removido de `usuarios_update`       | ✅ OK   |
| Policies legadas redundantes dropadas               | ✅ OK   |
| Isolamento por `cliente_id` no supervisor           | ✅ OK   |
| Operador restrito ao próprio row (SELECT)           | ✅ OK   |
| Operador bloqueado de INSERT/UPDATE de terceiros    | ✅ OK   |
