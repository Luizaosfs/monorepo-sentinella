# VALIDAÇÃO — RLS da tabela `papeis_usuarios`

**Migration de referência:** `supabase/migrations/20260924000000_fix_rls_usuarios_papeis.sql`
**Data da correção:** 2026-09-24
**Validado em:** 2026-04-02

---

## 1. Problema corrigido

A policy `"Admins gerenciam todos os papeis"` era do tipo `FOR ALL`, que no PostgreSQL aplica
a mesma condição em SELECT, INSERT, UPDATE e DELETE. Combinada por OR com policies
por-operação existentes, podia expandir acesso de forma inesperada.

Além disso, `papeis_usuarios_select` incluía condições que concediam acesso excessivo.
Não havia restrição explícita impedindo operador de ler papéis de outros usuários.

---

## 2. Estado atual das policies (pós-correção)

### 2.1 `papeis_usuarios_select`

```sql
CREATE POLICY "papeis_usuarios_select" ON public.papeis_usuarios
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  );
```

| Papel       | Pode ler papéis alheios? | Base                                         |
|-------------|--------------------------|----------------------------------------------|
| admin       | Sim — todos              | `is_admin()`                                 |
| supervisor  | Sim — do próprio cliente | `supervisor_pode_gerir_usuario(usuario_id)`  |
| operador    | **Não** — só o próprio   | `usuario_id = auth.uid()`                    |
| notificador | **Não** — só o próprio   | `usuario_id = auth.uid()`                    |

A policy "Usuarios leem seus proprios papeis" pré-existente foi **mantida** como camada adicional
de garantia (o row do próprio usuário é sempre visível). ✅

---

### 2.2 `papeis_usuarios_insert`

```sql
CREATE POLICY "papeis_usuarios_insert" ON public.papeis_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
  );
```

| Papel       | Pode inserir papel para outro? | Restrição adicional                       |
|-------------|--------------------------------|-------------------------------------------|
| admin       | Sim — qualquer papel           | Nenhuma                                   |
| supervisor  | Sim — só no próprio cliente    | `papel_permitido_para_supervisor(papel)`  |
| operador    | **Não**                        | —                                         |
| notificador | **Não**                        | —                                         |

**Papéis que supervisor pode atribuir:** `'operador'`, `'notificador'` apenas.
**Bloqueados para supervisor:** `'admin'`, `'supervisor'`, `'moderador'`, `'usuario'`. ✅

---

### 2.3 `papeis_usuarios_update`

```sql
CREATE POLICY "papeis_usuarios_update" ON public.papeis_usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_supervisor()
      AND public.supervisor_pode_gerir_usuario(usuario_id)
      AND public.papel_permitido_para_supervisor(papel::text)
    )
  );
```

USING controla quais rows o UPDATE pode selecionar; WITH CHECK garante que o valor final do
papel também respeita a restrição. Supervisor não pode escalar seu UPDATE para atribuir `admin`. ✅

---

### 2.4 `papeis_usuarios_delete`

```sql
CREATE POLICY "papeis_usuarios_delete" ON public.papeis_usuarios
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.supervisor_pode_gerir_usuario(usuario_id)
  );
```

Operador não pode revogar papéis de ninguém. ✅

---

## 3. Policy legada dropada

| Policy removida                        | Motivo                                                       |
|----------------------------------------|--------------------------------------------------------------|
| "Admins gerenciam todos os papeis"     | Policy FOR ALL substituída por 4 policies por-operação       |

A remoção elimina a ambiguidade de semântica OR entre policies FOR ALL e por-operação. ✅

---

## 4. Função `papel_permitido_para_supervisor`

```sql
CREATE OR REPLACE FUNCTION public.papel_permitido_para_supervisor(p_papel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(p_papel) IN ('operador', 'notificador');
$$;
```

| Papel testado  | Retorno   |
|----------------|-----------|
| `'operador'`   | `true`    |
| `'notificador'`| `true`    |
| `'admin'`      | `false`   |
| `'supervisor'` | `false`   |
| `'moderador'`  | `false`   |
| `'usuario'`    | `false`   |
| `'OPERADOR'`   | `true`    | (case-insensitive via LOWER)

Supervisor não pode autopromover outro usuário para supervisor nem criar admin. ✅

---

## 5. Funções de operador removidas

```sql
DROP FUNCTION IF EXISTS public.operador_pode_gerir_usuario(uuid);
DROP FUNCTION IF EXISTS public.papel_permitido_para_operador(text);
```

Funções que permitiam operador gerir usuários foram completamente removidas do banco. ✅

---

## 6. Resultado

| Verificação                                              | Status  |
|----------------------------------------------------------|---------|
| Policy FOR ALL "Admins gerenciam todos os papeis" dropada | ✅ OK  |
| SELECT restrito: operador vê apenas próprio papel        | ✅ OK   |
| INSERT restrito: operador bloqueado                      | ✅ OK   |
| UPDATE restrito: operador bloqueado                      | ✅ OK   |
| DELETE restrito: operador bloqueado                      | ✅ OK   |
| Supervisor não pode atribuir admin/supervisor            | ✅ OK   |
| `papel_permitido_para_supervisor` = operador+notificador | ✅ OK   |
| Funções de operador removidas do banco                   | ✅ OK   |
