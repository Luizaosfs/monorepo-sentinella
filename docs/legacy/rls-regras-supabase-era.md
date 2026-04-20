# Regras RLS (Row Level Security) — Sentinella

Este documento descreve as políticas de segurança por tabela. Todas as políticas usam **usuários autenticados** (`TO authenticated`).

## Funções auxiliares

| Função | Descrição |
|--------|-----------|
| `usuario_pode_acessar_cliente(p_cliente_id)` | Retorna verdadeiro se o usuário logado está vinculado ao `cliente_id` (em `usuarios`) **ou** é **admin** (tem papel em `papeis_usuarios`). |
| `is_admin()` | Retorna verdadeiro se o usuário logado tem papel `admin` em `papeis_usuarios`. |
| `usuario_cliente_id()` | Retorna o `cliente_id` do usuário logado (em `usuarios`). NULL se não existir. |
| `is_operador()` | Retorna verdadeiro se o usuário logado tem papel `operador` em `papeis_usuarios`. |
| `papel_permitido_para_operador(p_papel)` | Retorna verdadeiro se o papel é `operador` ou `usuario` (operador só pode atribuir esses papéis). |
| `operador_pode_gerir_usuario(p_usuario_auth_id)` | Retorna verdadeiro se o usuário logado é operador e o `auth_id` informado pertence a um usuário do mesmo cliente. |

## Regras por tabela

### Por `cliente_id` (acesso direto)

Acesso permitido quando `usuario_pode_acessar_cliente(cliente_id)`.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| **regioes** | ✓ por cliente | ✓ por cliente | ✓ por cliente | ✓ por cliente |
| **levantamentos** | ✓ por cliente | ✓ por cliente | ✓ por cliente | ✓ por cliente |
| **planejamento** | ✓ por cliente | ✓ por cliente | ✓ por cliente | ✓ por cliente |
| **pluvio_operacional_run** | ✓ por cliente | ✓ por cliente | ✓ por cliente | ✓ por cliente |
| **sentinela_risk_policy** | ✓ por cliente | ✓ por cliente | ✓ por cliente | ✓ por cliente |

### Por cliente via tabela pai (FK)

Acesso permitido quando o registro da tabela pai (ex.: levantamento, planejamento, run, policy) pertence a um cliente que o usuário pode acessar.

| Tabela | Tabela pai | Regra |
|--------|------------|--------|
| **levantamento_itens** | levantamentos | `levantamento.cliente_id` acessível |
| **voos** | planejamento | `planejamento.cliente_id` acessível |
| **pluvio_risco** | regioes | `regiao.cliente_id` acessível |
| **pluvio_operacional_item** | pluvio_operacional_run | `run.cliente_id` acessível |
| **sentinela_risk_defaults**, **sentinela_risk_bin_***, **sentinela_risk_rule**, etc. | sentinela_risk_policy | `policy.cliente_id` acessível |

### Só admin (escrita) / Operador (gestão limitada)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| **clientes** | ✓ quem pode acessar o cliente | só admin | só admin | só admin |
| **usuarios** | próprio ou admin ou operador (do seu cliente) | admin ou operador (só seu cliente) | admin ou operador (só seu cliente) | só admin |
| **papeis_usuarios** | admin ou operador (usuários do seu cliente) | admin ou operador (papéis `operador`/`usuario` só no seu cliente) | admin ou operador (idem) | admin ou operador (idem) |
| **drones** | todos autenticados | só admin | só admin | só admin |

**Operador:** vê e edita apenas usuários do **mesmo cliente** (`usuarios.cliente_id` = `usuario_cliente_id()`). Pode atribuir apenas papéis `operador` e `usuario`. Não pode remover usuários (DELETE em `usuarios` continua só admin).

## Ordem de execução das migrações

1. **20250301000000_allow_null_auth_id_usuarios.sql** — permite `auth_id` nulo em `usuarios` (se ainda não rodou).
2. **20250302000000_regioes_rls_policies.sql** — RLS só em `regioes` (opcional; está incluído na migração geral).
3. **20250302100000_rls_geral_todas_tabelas.sql** — funções + RLS em **todas** as tabelas listadas acima.
4. **20250306000000_operador_gestao_usuarios_rls.sql** — funções `usuario_cliente_id`, `is_operador`, `papel_permitido_para_operador`, `operador_pode_gerir_usuario` e políticas de **usuarios** e **papeis_usuarios** para permitir gestão limitada pelo operador (apenas usuários do seu cliente e papéis operador/usuario).

Recomendação: rodar as migrações na ordem no SQL Editor do Supabase. A migração **20250306000000** deve ser executada **após** a **20250302100000**.

## Se `cliente_id` for TEXT (não UUID)

No início de **20250302100000_rls_geral_todas_tabelas.sql**, altere a assinatura da função:

```sql
-- De:
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid)

-- Para:
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id text)
```

E, se existir, a função `usuario_pode_acessar_risk_policy` também:

```sql
-- De:
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_risk_policy(p_policy_id uuid)

-- Para:
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_risk_policy(p_policy_id text)
```

## Tabelas sentinela_risk_*

As tabelas de política de risco (`sentinela_risk_policy`, `sentinela_risk_defaults`, etc.) são tratadas dentro de blocos `DO $$ ... $$` que só criam políticas **se a tabela existir**. Se o seu projeto ainda não tiver essas tabelas, essas partes não geram erro.
