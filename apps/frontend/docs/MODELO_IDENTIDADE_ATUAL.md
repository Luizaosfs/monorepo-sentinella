# Modelo de Identidade Atual — Sentinella

**Auditado em:** 2026-04-11
**Fonte:** dump `backup_20260411_124445/database/database.sql`

---

## 1. Visão geral das entidades de identidade

```
auth.users (Supabase Auth)
  └── id (uuid)  ←── auth.uid() retorna este valor
        │
        ▼
public.usuarios
  ├── id        (uuid, PK, gen_random_uuid())   ← ID interno do domínio
  ├── auth_id   (uuid, FK → auth.users.id)      ← ponte para o Auth
  ├── cliente_id (uuid, FK → clientes.id)       ← multitenancy
  ├── nome, email, ativo, onboarding_*
  └── created_at, updated_at

public.papeis_usuarios
  ├── id         (uuid, PK)
  ├── usuario_id (uuid)   ← guarda auth.uid() (= auth.users.id), NÃO usuarios.id
  └── papel      (papel_app enum: admin | supervisor | agente | notificador)
        + CONSTRAINT chk_papel_canonico
```

---

## 2. O que é `auth.uid()`

`auth.uid()` é uma função do Supabase Auth que retorna o UUID da sessão autenticada atual. Esse UUID corresponde ao campo `auth.users.id` — a chave primária da tabela interna de autenticação do Supabase.

Usado em:
- Todas as funções de papel (`is_admin()`, `is_supervisor()`, `is_agente()`, `is_notificador()`)
- Políticas RLS de `usuarios` (`auth_id = auth.uid()`)
- `get_meu_papel()`, `get_my_cliente_id()`
- `usuario_pode_acessar_cliente()` (via `is_admin()` ou `usuarios.auth_id`)

---

## 3. `usuarios.id` vs `usuarios.auth_id`

| Campo | Tipo | Valor | Uso |
|---|---|---|---|
| `usuarios.id` | uuid (PK) | gerado pelo banco (`gen_random_uuid()`) | chave interna do domínio — joins entre tabelas do Sentinella |
| `usuarios.auth_id` | uuid | copiado de `auth.users.id` | ponte para o Auth; usado por funções de papel e RLS |

**Diferença crítica:** `usuarios.id` é o ID do domínio (usado em FKs como `levantamentos.agente_id`). `usuarios.auth_id` é o ID do Auth (usado em funções SQL de segurança). São UUIDs diferentes para o mesmo usuário.

Exemplo de join correto:
```sql
-- Para obter o cliente_id do usuário logado:
SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid();

-- Para obter papéis de um usuário conhecido pelo auth_id:
SELECT papel FROM papeis_usuarios WHERE usuario_id = auth.uid();
```

---

## 4. Por que `papeis_usuarios.usuario_id` guarda `auth.uid()` e não `usuarios.id`

Este é o design intencional do sistema. A coluna `papeis_usuarios.usuario_id` armazena o `auth.users.id` (= `auth.uid()`) por duas razões:

**4.1 Performance em RLS**
As funções de papel são chamadas em *toda* avaliação de política RLS. Se `papeis_usuarios.usuario_id` guardasse `usuarios.id` (o ID interno), cada verificação exigiria um JOIN adicional:
```sql
-- Se fosse pelo id interno (mais lento):
SELECT 1 FROM papeis_usuarios pu
JOIN usuarios u ON u.id = pu.usuario_id
WHERE u.auth_id = auth.uid() AND pu.papel = 'admin'

-- Como está (fast-path direto):
SELECT 1 FROM papeis_usuarios pu
WHERE pu.usuario_id = auth.uid() AND pu.papel = 'admin'
```

**4.2 Acesso sem JOIN em funções SECURITY DEFINER**
`get_meu_papel()` e `is_*()` são `SECURITY DEFINER STABLE` — precisam ser o mais simples possível para o planner do PostgreSQL fazer cache eficiente.

**Consequência:** `papeis_usuarios` não tem FK explícita para `usuarios.id`. O vínculo é implícito via `auth_id`. Isso é documentado no código e foi uma decisão arquitetural deliberada.

---

## 5. Fluxo completo de verificação de papel

```
Request do usuário autenticado
  │
  ├── JWT token contém app_metadata.papel?
  │     ├── SIM → fast-path: retorna valor do JWT (sem IO)
  │     └── NÃO → fallback: SELECT em papeis_usuarios WHERE usuario_id = auth.uid()
  │
  └── Resultado: boolean (is_admin/is_supervisor/etc.) ou text (get_meu_papel)
```

O JWT fast-path é populado pelo `custom_access_token_hook` (migration `20261015000001`) que injeta `app_metadata.papel` e `app_metadata.cliente_id` no token em cada login.

---

## 6. Funções que dependem deste modelo

| Função | Depende de | Coupling crítico |
|---|---|---|
| `is_admin()` | `papeis_usuarios.usuario_id = auth.uid()` | `usuario_id` deve ser `auth.uid()` |
| `is_supervisor()` | `papeis_usuarios.usuario_id = auth.uid()` | idem |
| `is_agente()` | `papeis_usuarios.usuario_id = auth.uid()` | idem |
| `is_notificador()` | `papeis_usuarios.usuario_id = auth.uid()` | idem |
| `get_meu_papel()` | `papeis_usuarios.usuario_id = auth.uid()` | idem |
| `tem_papel(uuid, papel_app)` | `papeis_usuarios.usuario_id = _usuario_id` | recebe auth_id como argumento |
| `usuario_pode_acessar_cliente()` | `usuarios.auth_id = auth.uid()` + `is_admin()` | depende dos dois |
| `get_papeis_by_cliente()` | `papeis_usuarios` JOIN `usuarios ON auth_id = usuario_id` | join via auth_id |
| RLS de `usuarios` | `auth_id = auth.uid()` | coluna `auth_id` da tabela `usuarios` |
| RLS de `papeis_usuarios` | `is_admin()` ou `is_supervisor()` | indiretamente |

---

## 7. Cuidados ao normalizar no futuro

Se em algum momento houver necessidade de normalizar `papeis_usuarios.usuario_id` para apontar para `usuarios.id` (o ID interno), as implicações são:

1. **Todas as funções `is_*()` precisam ser reescritas** com um JOIN extra para `usuarios`.
2. **Todas as políticas RLS** que chamam essas funções precisam ser recriadas (DROP + CREATE — não é possível ALTER).
3. **O JWT fast-path** continua funcionando, mas o DB fallback muda de custo.
4. **`tem_papel(uuid, papel_app)`** muda semântica: o argumento `_usuario_id` passaria a ser `usuarios.id` em vez de `auth_id`.
5. **Risco de quebra silenciosa**: qualquer código que passe `auth.uid()` para `tem_papel()` quebraria silenciosamente (sem erro, apenas sem papel).

**Recomendação:** Não normalizar sem uma migration de transição explícita com backfill e smoke tests de RLS.

---

## 8. Estado do enum `papel_app`

```sql
CREATE TYPE public.papel_app AS ENUM (
    'admin',
    'supervisor',
    'agente',
    'notificador'
);
```

Valores removidos em `20261015000003`: `operador`, `usuario`, `platform_admin`.
Proteção adicional: `CONSTRAINT chk_papel_canonico` em `papeis_usuarios`.

---

## 9. Diagrama resumido

```
auth.uid() ──────────────────────────────────────────────┐
                                                          │
usuarios                                                  ▼
┌──────────────────────────────┐         papeis_usuarios
│ id (interno)                 │         ┌───────────────────────────┐
│ auth_id ─────────────────────┼────────▶│ usuario_id = auth.uid()   │
│ cliente_id ──┐               │         │ papel: papel_app enum     │
│ nome, email  │               │         │ chk_papel_canonico        │
└──────────────┼───────────────┘         └───────────────────────────┘
               │
               ▼
           clientes
           ┌─────────┐
           │ id      │
           │ nome    │
           │ slug    │
           └─────────┘
```
