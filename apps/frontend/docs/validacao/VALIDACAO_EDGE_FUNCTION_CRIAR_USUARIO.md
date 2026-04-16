# VALIDAÇÃO — Edge Function `criar-usuario`

**Arquivo:** `supabase/functions/criar-usuario/index.ts`
**Validado em:** 2026-04-02

---

## 1. Visão geral

A Edge Function `criar-usuario` é o único ponto de provisionamento de usuários no sistema.
Ela usa dois clientes Supabase com diferentes níveis de privilégio, nunca expondo a
`service_role key` ao frontend.

---

## 2. Fluxo de verificação de autorização

### Passo 1 — Autenticar o chamador

```ts
const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});
```

O `callerClient` usa a **anon key** combinada com o JWT do usuário autenticado. Isso garante
que as chamadas ao banco pelo `callerClient` respeitam as policies RLS do chamador.

Sem `Authorization` header → resposta `401 Unauthorized`.

---

### Passo 2 — Verificar papel via RPC

```ts
const { data: papelChamador } = await callerClient.rpc('get_meu_papel');
if (papelErr || !papelChamador) return json({ error: 'Forbidden' }, 403);
```

`get_meu_papel()` é uma função SECURITY DEFINER que retorna o papel do usuário autenticado
consultando `papeis_usuarios` com o JWT. Não pode ser forjada pelo frontend.

Papel inválido ou ausente → `403 Forbidden`.

---

### Passo 3 — Bloquear papéis insuficientes

```ts
const isAdmin = papelChamador === 'admin';
const isSupervisor = papelChamador === 'supervisor' || papelChamador === 'moderador';

if (!isAdmin && !isSupervisor) return json({ error: 'Forbidden: papel insuficiente' }, 403);
```

| Papel chamador | Pode criar usuário? |
|----------------|---------------------|
| `admin`        | Sim                 |
| `supervisor`   | Sim (com restrições)|
| `moderador`    | Sim (alias de supervisor, com restrições) |
| `operador`     | **Não** — 403       |
| `notificador`  | **Não** — 403       |
| qualquer outro | **Não** — 403       |

---

### Passo 4 — Restrição de papel para supervisor

```ts
const PAPEIS_RESTRITOS_SUPERVISOR = ['admin', 'supervisor', 'moderador'];
if (isSupervisor && PAPEIS_RESTRITOS_SUPERVISOR.includes(papelNorm)) {
  return json({ error: 'Supervisor não pode criar usuários com este papel' }, 403);
}
```

Supervisor não pode criar usuários com papel `admin`, `supervisor` ou `moderador`.
Papéis permitidos para supervisor criar: `operador`, `notificador`, e quaisquer outros não restritos.

---

### Passo 5 — Restrição de cliente para supervisor

```ts
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

Supervisor que tentar criar usuário em `cliente_id` diferente do seu próprio → `403`.
Esta verificação usa `callerClient` (sujeito a RLS), portanto não pode ser forjada. ✅

---

## 3. Criação via `adminClient` (service_role)

```ts
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

O `adminClient` com `service_role` é usado **exclusivamente** para operações privilegiadas:
1. `auth.admin.createUser()` — cria login no Supabase Auth
2. `usuarios.insert()` — insere registro de usuário
3. `papeis_usuarios.insert()` — atribui papel

A `service_role key` nunca trafega pelo frontend nem é exposta no cliente. ✅

---

## 4. Mecanismos de segurança adicionais

### 4.1 Verificação de e-mail duplicado
```ts
const { data: existing } = await adminClient.from('usuarios')
  .select('id').eq('email', emailNorm).maybeSingle();
if (existing) return json({ error: 'EMAIL_EXISTS' }, 409);
```
Previne duplicação de conta.

### 4.2 Rollback em falha de inserção
```ts
if (insertErr) {
  await adminClient.auth.admin.deleteUser(authId);
  return json({ error: insertErr.message }, 500);
}
```
Se inserção em `usuarios` falhar após criação do login Auth, o auth user é removido para
evitar usuários órfãos.

### 4.3 `email_confirm: true`
Usuários provisionados por admin não precisam confirmar e-mail — já verificados pelo admin.

### 4.4 `must_change_password: true`
Todo usuário criado via Edge Function deve trocar a senha no primeiro login.

---

## 5. Fluxo no frontend (AdminUsuarios.tsx)

```ts
await supabase.functions.invoke('criar-usuario', {
  body: { nome, email, senha, cliente_id, papel },
});
```

Frontend invoca a Edge Function via `supabase.functions.invoke`. O JWT do usuário autenticado
é automaticamente incluído no header `Authorization`. Nunca há chamada direta a
`supabase.auth.signUp()` nem acesso à `service_role key` no frontend. ✅

---

## 6. Resultado

| Verificação                                              | Status  |
|----------------------------------------------------------|---------|
| Autenticação via JWT do chamador                         | ✅ OK   |
| Papel verificado via `get_meu_papel()` (SECURITY DEFINER) | ✅ OK  |
| Operador/notificador bloqueados (403)                    | ✅ OK   |
| Supervisor bloqueado de criar admin/supervisor           | ✅ OK   |
| Supervisor bloqueado de criar em outro cliente           | ✅ OK   |
| `service_role` nunca exposta ao frontend                 | ✅ OK   |
| Rollback de auth user em falha de inserção               | ✅ OK   |
| `must_change_password` em todo usuário criado            | ✅ OK   |
