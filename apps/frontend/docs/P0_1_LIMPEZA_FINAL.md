# P0.1 — Limpeza Final: Relatório de Auditoria

**Data:** 2026-04-11
**Escopo:** Funções de papel SQL + SELECTs diretos no frontend
**Fonte:** `/d/sentinella/backup_20260411_124445/database/database.sql`

---

## TAREFA 1 — Strings mortas em funções de papel

### Funções auditadas e resultado

| Função | Corpo no dump | Strings de papel encontradas | Dead strings? |
|---|---|---|---|
| `public.is_admin()` | JWT fast-path `= 'admin'` + DB fallback `papel::text = 'admin'` | `admin` | **NENHUMA** |
| `public.is_supervisor()` | JWT fast-path `= 'supervisor'` + DB fallback `LOWER(papel::text) = 'supervisor'` | `supervisor` | **NENHUMA** |
| `public.is_agente()` | JWT fast-path `= 'agente'` + DB fallback `LOWER(papel::text) = 'agente'` | `agente` | **NENHUMA** |
| `public.is_notificador()` | JWT fast-path `= 'notificador'` + DB fallback `LOWER(papel::text) = 'notificador'` | `notificador` | **NENHUMA** |
| `public.get_meu_papel()` | Escada de prioridade: admin=5, supervisor=4, agente=3, notificador=2, else=0 | `admin`, `supervisor`, `agente`, `notificador` | **NENHUMA** |
| `public.usuario_pode_acessar_cliente()` | Delega para `is_admin()` + JWT fast-path `cliente_id` | — | **NENHUMA** |

Não existe `public.is_gestor()` — papel `gestor` não é canônico (o papel equivalente é `supervisor`).

### R4 — is_supervisor() aceitava 'moderador'

**STATUS: FALSO POSITIVO — risco já eliminado antes desta auditoria.**

O risco R4 documentado no P0 anterior descrevia `is_supervisor()` aceitando `'moderador'` no fallback DB. Isso era verdade em migrations anteriores (20260326143000 criou uma versão da função que verificava `moderador` como alias legado).

O dump atual (estado de produção em 2026-04-11) contém a versão reescrita pela migration `20261015000002`, cujo corpo executável é:

```sql
SELECT CASE
  WHEN (auth.jwt() -> 'app_metadata' ->> 'papel') IS NOT NULL
  THEN (auth.jwt() -> 'app_metadata' ->> 'papel') = 'supervisor'
  ELSE EXISTS (
    SELECT 1 FROM public.papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND LOWER(pu.papel::text) = 'supervisor'
  )
END;
```

Sem menção a `moderador`. O COMMENT documenta explicitamente: _"moderador nunca existiu no enum — não há alias."_

### Enum papel_app — estado atual

```sql
CREATE TYPE public.papel_app AS ENUM (
    'admin',
    'supervisor',
    'agente',
    'notificador'
);
COMMENT ON TYPE public.papel_app IS
  'Enum canônico final. Valores: admin, supervisor, agente, notificador.
   Nenhum valor morto. Limpeza concluída em migration 20261015000003.';
```

Os valores `operador`, `usuario` e `platform_admin` foram **removidos do enum** pela migration `20261015000003` via estratégia de _shadow column_ (único método viável quando há dependências RLS no PostgreSQL).

### Funções mortas já removidas (confirmado no dump)

| Função | Removida em | Motivo |
|---|---|---|
| `is_operador()` | 20261015000002 | Substituída por `is_agente()` |
| `papel_permitido_para_operador()` | 20261015000002 | Aceitava `'operador'`, `'usuario'` — valores mortos |
| `operador_pode_gerir_usuario()` | 20261015000002 | Chamava `is_operador()` |
| `is_platform_admin()` | 20260910000000 (S01) | `platform_admin` neutralizado |

### O que foi corrigido nesta auditoria

**Nada.** O banco já estava em estado canônico. A migration `20260411010000_p01_limpeza_final.sql` foi criada como registro de auditoria (executa apenas um `SELECT` informativo).

---

## TAREFA 2 — SELECTs diretos fora de api.ts

### Ocorrências encontradas

#### Grupo A — `src/lib/seedDefaultRiskPolicy.ts`

12 chamadas `supabase.from('sentinela_risk_*').insert(...)` em tabelas de configuração de risco pluvial.

**Classificação: PODE_PERMANECER**

Justificativa: `seedDefaultRiskPolicy.ts` é uma função utilitária de seed executada apenas na criação de um novo cliente. Não é chamada em fluxo de usuário normal. As tabelas `sentinela_risk_*` são tabelas de configuração de infraestrutura, não tabelas de dados sensíveis do domínio. Mover para `api.ts` não agrega valor de segurança.

#### Grupo B — `src/pages/agente/AgenteVistoria.tsx` (linha ~30)

```typescript
supabase
  .from('focos_risco')
  .select('id, status, created_at, foco_anterior_id')
  .eq('cliente_id', clienteId)
  .eq('imovel_id', imovelId)
  .in('status', ['confirmado', 'em_tratamento', 'resolvido'])
  .is('deleted_at', null)
  .gte('created_at', since60d)
  .limit(50)
```

**Classificação: MIGRAR_SPRINT**

Justificativa: `focos_risco` é tabela sensível. A query está tecnicamente correta (filtra `cliente_id` + `imovel_id`, usa soft-delete). No entanto, está dentro de um `useQuery` inline em componente de página, sem passar por `api.ts`. Deve ser extraída para `api.focosRisco.listByImovel(clienteId, imovelId, since60d)` na próxima sprint de housekeeping.

#### Grupo C — `src/pages/operador/OperadorFormularioVistoria.tsx` (linha ~142)

```typescript
supabase
  .from('imoveis')
  .select('logradouro, numero, bairro')
  .eq('id', imovelId!)
  .single()
```

**Classificação: PODE_PERMANECER**

Justificativa: `imoveis` não é tabela sensível (sem dados pessoais). Query é leitura simples de 3 campos para exibição de label no header do stepper. Filtro por PK (`eq('id', imovelId)`). Sem lógica de domínio. Não justifica migração imediata.

#### Grupo D — `src/hooks/useClienteAtivo.tsx` (linhas ~58 e ~85)

Duas queries em `clientes`:
- `SELECT * FROM clientes WHERE ativo = true ORDER BY nome` (lista para admin)
- `SELECT * FROM clientes WHERE id = userClienteId LIMIT 1` (cliente do usuário)

**Classificação: PODE_PERMANECER**

Justificativa: `useClienteAtivo` é o hook central de multitenancy, chamado antes de qualquer operação. Mover para `api.ts` criaria dependência circular (api.ts usa clienteId que vem deste hook). Padrão intencional e documentado.

#### Grupo E — `src/pages/admin/AdminCanalCidadao.tsx` (linha ~147)

```typescript
supabase.from('clientes').select('id, nome, slug').eq('id', clienteId).single()
```

**Classificação: MIGRAR_SPRINT**

Justificativa: Leitura simples, mas `clientes` tem RLS admin-only para escrita. A leitura deveria estar em `api.clientes.get(clienteId)` para consistência. Baixa urgência.

#### Grupo F — `src/pages/admin/AdminClientes.tsx` (linha ~120)

```typescript
supabase.from('clientes').update({ ativo: false, deleted_at: ... }).eq('id', id)
```

**Classificação: MIGRAR_AGORA**

Justificativa: **UPDATE em tabela sensível fora de api.ts.** `clientes` é a raiz do modelo de multitenancy. Soft-delete de cliente deve estar em `api.clientes.softDelete(id)` para centralizar auditoria e evitar duplicação de lógica. É a única escrita direta em tabela sensível encontrada.

#### Grupo G — Páginas públicas (`MunicipioPublico.tsx`, `PortalDenuncia.tsx`)

Leituras em `clientes` filtradas por `slug` ou `id` sem autenticação (páginas públicas).

**Classificação: PODE_PERMANECER**

Justificativa: Páginas públicas sem auth não podem usar `api.ts` (que depende de `useClienteAtivo`). As queries são somente leitura, campos mínimos (`id, nome, slug`), e o RLS de `clientes` permite SELECT para `usuario_pode_acessar_cliente()` — que retorna false para anônimos, mas as policies de `clientes` usam `USING (public.usuario_pode_acessar_cliente(id))` — a leitura pública é protegida pela RLS do Supabase (anon key com RLS).

#### Grupo H — Realtime subscriptions (`useMapaFocosRealtime.ts`, `usePainelSLA.ts`, `useRealtimeInvalidator.ts`, `GestorFocos.tsx`)

Calls `supabase.removeChannel(channel)` — apenas limpeza de subscriptions Realtime.

**Classificação: PODE_PERMANECER**

Justificativa: Subscriptions Realtime não passam por `api.ts` por design (são event listeners, não queries). Padrão correto e intencional.

---

## O que deve migrar na próxima sprint

| Prioridade | Arquivo | Ação |
|---|---|---|
| **AGORA** | `AdminClientes.tsx:120` | Criar `api.clientes.softDelete(id)` e migrar UPDATE |
| Sprint | `AgenteVistoria.tsx:30` | Criar `api.focosRisco.listByImovel(...)` e migrar query inline |
| Sprint | `AdminCanalCidadao.tsx:147` | Criar `api.clientes.get(id)` e migrar leitura |

---

## Resumo executivo

| Item | Status |
|---|---|
| Strings mortas em funções de papel | **NENHUMA** — banco em estado canônico |
| R4 (is_supervisor + moderador) | **ELIMINADO** pela migration 20261015000002 |
| Enum papel_app com valores mortos | **ELIMINADO** pela migration 20261015000003 |
| Funções mortas (is_operador etc.) | **REMOVIDAS** pela migration 20261015000002 |
| SELECTs diretos críticos | **1 UPDATE** em `clientes` para migrar agora |
| SELECTs diretos aceitáveis | 7 ocorrências — documentadas e justificadas |
