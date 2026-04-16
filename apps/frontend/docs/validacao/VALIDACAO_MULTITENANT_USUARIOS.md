# VALIDAÇÃO — Isolamento multi-tenant em gestão de usuários

**Arquivos de referência:**
- `supabase/migrations/20260924000000_fix_rls_usuarios_papeis.sql`
- `supabase/functions/criar-usuario/index.ts`
- `src/pages/admin/AdminUsuarios.tsx`
- `src/hooks/useAuth.tsx`

**Validado em:** 2026-04-02

---

## 1. Princípio de isolamento

Cada cliente é uma prefeitura. Um supervisor do cliente A não pode ver, criar nem editar
usuários do cliente B. As camadas de isolamento são: RLS no banco, verificação na Edge Function,
e `useClienteAtivo()` no frontend.

---

## 2. Camada 1 — RLS na tabela `usuarios`

### SELECT — supervisor vê apenas o próprio cliente

```sql
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.is_admin()
    OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
  );
```

`public.usuario_cliente_id()` retorna o `cliente_id` do usuário autenticado (SECURITY DEFINER).
Supervisor só obtém rows onde `cliente_id` corresponde ao seu próprio cliente.

Tentativa de supervisor ler usuários de outro cliente → zero rows retornados pelo Supabase. ✅

### INSERT — supervisor insere apenas no próprio cliente

```sql
WITH CHECK (
  public.is_admin()
  OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
);
```

Se o payload tiver `cliente_id` diferente do supervisor → WITH CHECK falha → inserção rejeitada
com `42501` (insufficient privilege). ✅

### UPDATE — supervisor edita apenas no próprio cliente

```sql
USING (
  public.is_admin()
  OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
)
WITH CHECK (
  public.is_admin()
  OR (public.is_supervisor() AND cliente_id = public.usuario_cliente_id())
);
```

USING impede que supervisor acesse rows de outro cliente para UPDATE.
WITH CHECK impede que supervisor altere o `cliente_id` de um row para outro cliente. ✅

---

## 3. Camada 2 — RLS na tabela `papeis_usuarios`

```sql
-- SELECT
USING (
  usuario_id = auth.uid()
  OR public.is_admin()
  OR public.supervisor_pode_gerir_usuario(usuario_id)
);
```

`supervisor_pode_gerir_usuario(usuario_id)` verifica se o usuário alvo pertence ao mesmo
cliente do supervisor chamador (implementação interna usa `usuario_cliente_id()`).

Supervisor lendo papéis de usuário de outro cliente → zero rows. ✅

---

## 4. Camada 3 — Edge Function `criar-usuario`

```ts
// Supervisor só pode criar usuários no próprio cliente
if (isSupervisor) {
  const { data: eu } = await callerClient
    .from('usuarios')
    .select('cliente_id')
    .eq('auth_id', (await callerClient.auth.getUser()).data.user?.id ?? '')
    .maybeSingle();

  if (!eu || eu.cliente_id !== cliente_id) {
    return json({ error: 'Supervisor só pode criar usuários no próprio cliente' }, 403);
  }
}
```

A verificação usa `callerClient` (sujeito a RLS) para obter o `cliente_id` do supervisor.
O `cliente_id` no payload do request é comparado com o `cliente_id` do supervisor no banco.

Supervisor tentando criar usuário em outro `cliente_id` → `403 Forbidden`. ✅

Esta verificação não pode ser bypassada porque:
1. `callerClient` usa o JWT do chamador — o banco retorna apenas os dados do próprio usuário.
2. Se o supervisor não existir no banco (impossível se autenticado), `eu === null` → também 403.

---

## 5. Camada 4 — Frontend (`AdminUsuarios.tsx`)

O componente usa `useClienteAtivo()` para filtrar a listagem:

```ts
const { clienteId } = useClienteAtivo();
// A query em api.usuarios.listByCliente(clienteId) filtra por cliente_id
```

Mesmo que alguém manipule o estado local, o RLS do banco rejeita queries cross-tenant. A
camada frontend é complementar, não a barreira principal.

---

## 6. Funções SQL de suporte ao isolamento

| Função                              | Descrição                                          |
|-------------------------------------|----------------------------------------------------|
| `usuario_cliente_id()`              | Retorna `cliente_id` do usuário autenticado (SECURITY DEFINER) |
| `is_admin()`                        | Verifica papel admin — admin vê todos os clientes  |
| `is_supervisor()`                   | Verifica papel supervisor                          |
| `supervisor_pode_gerir_usuario(uid)`| Verifica se uid pertence ao mesmo cliente          |

Todas são `SECURITY DEFINER` com `SET search_path = public` — não podem ser influenciadas
por schema injection. ✅

---

## 7. Cenários de ataque e respostas

| Cenário                                             | Resposta do sistema                      |
|-----------------------------------------------------|------------------------------------------|
| Supervisor envia `cliente_id` de outro cliente na Edge Function | 403 Forbidden               |
| Supervisor tenta UPDATE direto em usuário de outro cliente via Supabase client | RLS rejeita (zero rows afetados) |
| Supervisor tenta SELECT direto em usuários de outro cliente | RLS retorna zero rows         |
| Operador tenta qualquer operação em usuários alheios | RLS bloqueia — apenas próprio row via `auth_id = auth.uid()` |
| Usuário sem papel (`null`) tenta qualquer operação  | JWT inválido ou sem papel → 401/403      |

---

## 8. Resultado

| Verificação                                              | Status  |
|----------------------------------------------------------|---------|
| SELECT RLS: supervisor vê apenas usuários do próprio cliente | ✅ OK |
| INSERT RLS: supervisor insere apenas no próprio cliente  | ✅ OK   |
| UPDATE RLS: supervisor edita apenas no próprio cliente   | ✅ OK   |
| Edge Function: verificação de cliente_id do supervisor   | ✅ OK   |
| `papeis_usuarios`: supervisor gerencia apenas seu cliente| ✅ OK   |
| Operador: acesso somente ao próprio row                  | ✅ OK   |
| Funções SQL SECURITY DEFINER — não forjáveis            | ✅ OK   |
