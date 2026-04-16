# VALIDAÇÃO — Papéis legados e inválidos

**Arquivos de referência:**
- `src/hooks/useAuth.tsx` — `normalizePapel()`
- `supabase/migrations/20260924000000_fix_rls_usuarios_papeis.sql` — `papel_permitido_para_supervisor`
- `src/pages/admin/AdminUsuarios.tsx` — tipo `PapelUsuario`

**Validado em:** 2026-04-02

---

## 1. Papéis ativos no sistema

O sistema reconhece 4 papéis ativos:

| Papel         | Descrição                          |
|---------------|------------------------------------|
| `admin`       | Administrador — acesso total       |
| `supervisor`  | Gestor municipal — acesso gestor   |
| `operador`    | Agente de campo — acesso operador  |
| `notificador` | Notificador de casos — acesso UBS  |

---

## 2. `normalizePapel()` — tratamento de papéis

```ts
// src/hooks/useAuth.tsx
export function normalizePapel(p: string): Papel {
  // papéis ativos → retorna normalizado
  // 'moderador' → 'supervisor' (alias legado do banco)
  // qualquer outro → null
  return null; // papel desconhecido → sem acesso; forçar re-login ou contato com admin
}
```

### Tabela de normalização completa

| Entrada             | Saída         | Observação                              |
|---------------------|---------------|-----------------------------------------|
| `'admin'`           | `'admin'`     | ativo                                   |
| `'ADMIN'`           | `'admin'`     | case-insensitive                        |
| `'supervisor'`      | `'supervisor'`| ativo                                   |
| `'operador'`        | `'operador'`  | ativo                                   |
| `'notificador'`     | `'notificador'`| ativo                                  |
| `'moderador'`       | `'supervisor'`| alias legado — mapeado para supervisor  |
| `'MODERADOR'`       | `'supervisor'`| case-insensitive                        |
| `'usuario'`         | `null`        | papel legado — **sem acesso**           |
| `'platform_admin'`  | `null`        | enum morto — **sem acesso**             |
| `'gestor'`          | `null`        | **sem acesso**                          |
| `''` (vazio)        | `null`        | **sem acesso**                          |
| `undefined`/`null`  | `null`        | **sem acesso**                          |
| qualquer desconhecido | `null`      | **sem acesso**                          |

`papel === null` → nenhuma rota protegida aceita o usuário. Todos os guards verificam
`isAdmin`, `isSupervisor`, etc., que derivam de `papel !== null`. ✅

---

## 3. `moderador` — alias legado

O papel `moderador` existe em alguns registros históricos do banco como alias para supervisor.
`normalizePapel` mapeia `'moderador'` → `'supervisor'` para compatibilidade retroativa.

A Edge Function `criar-usuario` também reconhece `moderador`:
```ts
const isSupervisor = papelChamador === 'supervisor' || papelChamador === 'moderador';
```

Usuários com `moderador` no banco recebem os mesmos privilégios de supervisor,
incluindo as restrições de não criar admin/supervisor. ✅

---

## 4. `usuario` — papel legado removido

O tipo `PapelUsuario` em `AdminUsuarios.tsx`:
```ts
type PapelUsuario = 'admin' | 'supervisor' | 'operador' | 'notificador';
```

`'usuario'` não faz mais parte do tipo. Novo usuário não pode ser criado com papel `'usuario'`
via o formulário de AdminUsuarios.

`normalizePapel('usuario')` → `null` → sem acesso a qualquer rota protegida.

**Ponto de atenção residual (cosmético):** `AdminUsuarios.tsx` linha 119:
```ts
papelMap.get(u.auth_id ?? '') ?? 'usuario'
```
Este é um fallback de **display** para o mapa de papéis quando a chave não existe. Não cria
nenhum usuário com papel `'usuario'`, não altera RLS, não afeta segurança. Impacto: exibe o
texto `"usuario"` na coluna Papel se o mapa não contiver a chave. Severidade: cosmética.

---

## 5. `platform_admin` — enum morto

Conforme documentado em `CLAUDE.md` e migration `20260702000000`:
- `platform_admin` é um valor morto no enum `papel_app`
- `is_platform_admin()` foi dropada
- `get_meu_papel()` ignora este valor
- `normalizePapel('platform_admin')` → `null`
- Nenhum usuário deve ter este papel; nenhuma função o verifica

✅ Sem risco de uso acidental.

---

## 6. Funções de operador removidas do banco

```sql
DROP FUNCTION IF EXISTS public.operador_pode_gerir_usuario(uuid);
DROP FUNCTION IF EXISTS public.papel_permitido_para_operador(text);
```

Essas funções foram dropadas pela migration `20260924000000`. Qualquer código que as referencie
receberá erro de função não encontrada, impedindo uso acidental. ✅

---

## 7. Restrição de papéis que supervisor pode atribuir

```sql
SELECT LOWER(p_papel) IN ('operador', 'notificador');
-- Bloqueados: admin, supervisor, moderador, usuario, platform_admin
```

Supervisor não pode criar nem modificar papéis elevados. Escalonamento de privilégios via
supervisor está bloqueado em 3 camadas:
1. `papel_permitido_para_supervisor()` no RLS de `papeis_usuarios` (INSERT/UPDATE)
2. `PAPEIS_RESTRITOS_SUPERVISOR` na Edge Function `criar-usuario`
3. Tipo `PapelUsuario` no frontend (`AdminUsuarios.tsx`) não expõe `admin` para supervisor

---

## 8. Resultado

| Verificação                                              | Status  |
|----------------------------------------------------------|---------|
| `'usuario'` → `null` em normalizePapel                  | ✅ OK   |
| `'platform_admin'` → `null` em normalizePapel           | ✅ OK   |
| `'moderador'` → `'supervisor'` (alias funcional)        | ✅ OK   |
| Papel desconhecido → `null` → sem acesso                 | ✅ OK   |
| `'usuario'` removido do tipo `PapelUsuario`              | ✅ OK   |
| Funções de operador dropadas do banco                    | ✅ OK   |
| `platform_admin` dead value — sem função que o use      | ✅ OK   |
| Supervisor não pode atribuir papel elevado               | ✅ OK   |
| Fallback `'usuario'` em display map (cosmético)          | ⚠️ residual cosmético |
