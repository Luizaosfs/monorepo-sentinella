# RELATÓRIO DE AUDITORIA TÉCNICA — SENTINELLA
**Data:** 2026-03-30
**Escopo:** Banco de dados · Edge Functions · Frontend · Mobile/Offline · Regras de negócio

---

## RESUMO EXECUTIVO

A auditoria identificou **4 classes de problemas** que explicam diretamente os sintomas relatados (dados não aparecem, apontamentos não chegam à plataforma):

| Classe | Severidade | Quantidade |
|---|---|---|
| Segurança / Multi-tenancy (cross-tenant leak) | CRÍTICO | 4 gaps |
| Sincronização offline (dados não chegam) | ALTO | 6 gaps |
| Consistência de dados (soft delete incompleto) | ALTO | 8 tabelas |
| Performance / Cache frontend | MÉDIO | 3 issues |

---

## 1. PROBLEMAS CRÍTICOS — CAUSA RAIZ DOS SINTOMAS

### 1.1 Mapa de Focos não mostra dados

**Causa:** `focosRisco.getById()` em `src/services/api.ts` (linha ~2870) não filtra por `cliente_id` nem por `deleted_at`.

```typescript
// ATUAL — ERRADO
.from('focos_risco')
.select('*')
.eq('id', id)               // ❌ sem cliente_id
                             // ❌ sem .is('deleted_at', null)

// CORRETO
.from('focos_risco')
.select('*')
.eq('id', id)
.eq('cliente_id', clienteId)
.is('deleted_at', null)
```

**Causa adicional:** `focosRisco.byLevantamentoItem()` (linha ~2983) também não filtra por `cliente_id` quando consulta `v_focos_risco_ativos`.

**Causa adicional:** `useFocosRisco.ts` usa objeto `filtros` inteiro como query key — objetos não são serializados de forma estável pelo React Query, gerando cache stale e requisições duplicadas.

### 1.2 Apontamentos do mobile não chegam na plataforma

**Causa primária — sem idempotência:** A fila offline (`src/lib/offlineQueue.ts`) gera IDs locais com `${Date.now()}-${Math.random()}` mas **não envia nenhum idempotency_key para a API**. Reenvios de rede criam registros duplicados ou falham com 23505 sem log adequado.

**Causa secundária — sem retry:** Operações que falham ficam na fila para sempre mas **nunca são tentadas novamente**. Não existe backoff exponencial, nem limite de tentativas, nem "dead letter queue". Uma operação travada no início da fila bloqueia todas as seguintes.

**Causa terciária — drain sem mutex:** Múltiplas chamadas a `drainQueue()` podem executar simultaneamente se o usuário alternar online/offline rapidamente, ou se o app estiver aberto em múltiplas abas. Isso causa **envios duplicados** ao servidor.

**Causa quaternária — 23505 tratado como sucesso cegamente:**
```typescript
// src/lib/offlineQueue.ts — lógica atual
if (error?.code === '23505') {
  ok++;      // ❌ conta como sucesso sem verificar se é o mesmo dado
  continue;
}
```
Um conflito de chave única pode estar mascarando falhas reais de dados diferentes.

### 1.3 Cross-tenant leak (segurança crítica)

`vistorias.listByImovel(imovelId)` (linha ~1684) filtra apenas por `imovel_id`, sem `cliente_id`. Um usuário autenticado de qualquer prefeitura pode acessar vistorias de outras prefeituras.

```typescript
// ATUAL — ERRADO
.from('vistorias')
.eq('imovel_id', imovelId)   // ❌ sem cliente_id

// CORRETO
.from('vistorias')
.eq('imovel_id', imovelId)
.eq('cliente_id', clienteId)
```

---

## 2. BANCO DE DADOS — ACHADOS

### 2.1 Soft Delete incompleto (risco de perda de dados)

O QW-10A implementou `deleted_at` apenas em 4 tabelas. As tabelas abaixo permitem `DELETE` real, sem recuperação:

| Tabela | Tem deleted_at? | Impacto |
|---|---|---|
| `imoveis` | ❌ | Imóvel deletado = perda de histórico de vistorias |
| `vistorias` | ❌ | Vistoria deletada = perda de dados de campo |
| `vistoria_depositos` | ❌ | Dados PNCD perdidos |
| `vistoria_sintomas` | ❌ | Casos suspeitos perdidos |
| `vistoria_riscos` | ❌ | Riscos sanitários perdidos |
| `vistoria_calhas` | ❌ | Calhas perdidas |
| `planejamentos` | ❌ | Histórico de planejamento perdido |
| `levantamentos` | ❌ | Levantamentos perdidos |
| `sla_operacional` | ❌ | Histórico SLA perdido |

**Recomendação:** Criar migration `qw10d_soft_delete_vistoria_module.sql` seguindo o padrão do QW-10A.

### 2.2 Pontos de conflito UNIQUE no sync mobile

Estes constraints causam erro 23505 na sincronização offline:

| Tabela | Constraint | Risco |
|---|---|---|
| `vistoria_depositos` | `(vistoria_id, tipo)` | **ALTO** — mobile envia depósito, retenta, conflito |
| `levantamentos` | `(cliente_id, planejamento_id, data_dia, tipo_entrada)` | **ALTO** — criação dupla bloqueada |
| `correlacao_vistoria_drone` | `(vistoria_id, levantamento_item_id)` | **ALTO** |
| `distribuicao_quarteirao_agente` | `(cliente_id, ciclo, quarteirao)` | **MÉDIO** |

A migration `20260713000000_vistoria_idempotencia_offline.sql` existe mas não foi suficiente — a lógica de `drainQueue` no frontend ainda não usa idempotency_key.

### 2.3 RLS — Status Geral

**Positivo:** Cobertura ampla via `usuario_pode_acessar_cliente()`. A correção em `20260319233000_fix_rls_vistoria_multitenancy_admin.sql` foi aplicada corretamente.

**Gap:** `push_subscriptions` usa `usuario_id` (não `cliente_id`) — o isolamento depende de JOIN com `usuarios`. Se um usuário trocar de cliente, as subscriptions antigas ficam acessíveis.

**Gap:** `levantamento_item_evidencias` sem `cliente_id` direto — depende de cadeia `item → levantamento → cliente_id`. Funciona, mas é frágil.

### 2.4 Edge Functions com verify_jwt = false

| Função | verify_jwt | Risco |
|---|---|---|
| `health-check` | false | Expõe config de email, Cloudinary, SLA errors |
| `cloudinary-upload-image` | false | **Upload não autenticado possível** |
| `billing-snapshot` | false | Dados financeiros acessíveis sem auth |
| `pluvio-risco-daily` | false | Aceitável (cron interno) |
| `sla-marcar-vencidos` | false | Aceitável (cron interno) |

**Ação imediata:** `health-check` e `cloudinary-upload-image` devem ter `verify_jwt = true`.

---

## 3. FRONTEND — ACHADOS

### 3.1 Queries sem filtro deleted_at

```
focosRisco.getById()         → sem .is('deleted_at', null)
focosRisco.list()            → depende da view v_focos_risco_ativos (ok se view filtra)
api.itens.*                  → a maioria filtra corretamente (linhas 109, 121, 132)
api.casosNotificados.list()  → verificar se filtra deleted_at
```

### 3.2 GestorFocos — pageSize hardcoded

```typescript
// src/pages/gestor/GestorFocos.tsx linha 38
useFocosRisco(clienteId, { pageSize: 200 })  // ❌ 200 registros na primeira carga
```
Para prefeituras com muitos focos, isso causa timeout e UX lenta. Reduzir para 50, com paginação incremental.

### 3.3 Query key instável em useFocosRisco

```typescript
// src/hooks/queries/useFocosRisco.ts
queryKey: ['focos_risco', clienteId, filtros]  // ❌ objeto filtros = referência instável
```
Cada render pode gerar nova referência para `filtros`, triggering refetch desnecessário.

```typescript
// CORRETO
queryKey: ['focos_risco', clienteId, filtros.status, filtros.regiao_id, filtros.page]
```

### 3.4 useVistoriasByImovel — query key sem clienteId

```typescript
queryKey: ['vistorias_imovel', imovelId]  // ❌ sem clienteId
```
Possível colisão de cache se dois clientes usarem mesmo imovelId (improvável mas incorreto).

---

## 4. SINCRONIZAÇÃO MOBILE — PLANO DE CORREÇÃO DETALHADO

### 4.1 Implementar idempotency_key

**Migration necessária:**
```sql
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;
ALTER TABLE vistoria_depositos ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;
```

**Frontend (offlineQueue.ts):**
```typescript
// Ao enfileirar
const item = {
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  idempotency_key: crypto.randomUUID(),  // ← NOVO
  operacao: 'save_vistoria',
  payload: { ... }
};

// Ao enviar para API
await supabase.from('vistorias').upsert(
  { ...payload, idempotency_key },
  { onConflict: 'idempotency_key', ignoreDuplicates: true }
);
```

### 4.2 Implementar mutex no drain

```typescript
// src/lib/offlineQueue.ts
let drainInProgress = false;

export async function drainQueue() {
  if (drainInProgress) return { ok: 0, failed: 0, skipped: 1 };
  drainInProgress = true;
  try {
    // ... lógica atual
  } finally {
    drainInProgress = false;
  }
}
```

### 4.3 Retry com backoff exponencial

```typescript
const MAX_RETRIES = 3;

for (const item of queue) {
  if (item.retry_count >= MAX_RETRIES) {
    await moveToDeadLetter(item);  // ← dead letter queue
    continue;
  }

  try {
    await processItem(item);
    ok++;
  } catch (err) {
    if (err.code === '23505') {
      ok++;  // idempotente — mesma key, ignora
    } else {
      item.retry_count = (item.retry_count || 0) + 1;
      item.next_retry_at = Date.now() + Math.pow(2, item.retry_count) * 1000;
      await updateQueueItem(item);
      failed++;
    }
  }
}
```

### 4.4 Melhorar log de sincronização

```typescript
// api.offlineSyncLog.registrar — adicionar campos
{
  operacao: string,
  erro: string,
  usuario_id: string,
  // ← NOVOS CAMPOS:
  idempotency_key: string,
  payload_resumo: string,   // JSON resumido (sem dados sensíveis)
  retry_count: number,
  http_status: number
}
```

---

## 5. EDGE FUNCTIONS — CORREÇÕES

### 5.1 cloudinary-upload-image — adicionar auth

```toml
# supabase/config.toml
[functions.cloudinary-upload-image]
verify_jwt = true   # ← alterar de false para true
```

E dentro da função, validar que o usuário pertence ao cliente do recurso.

### 5.2 health-check — restringir acesso

```toml
[functions.health-check]
verify_jwt = true
```
Ou remover dados sensíveis (config email, chaves Cloudinary) da resposta pública.

### 5.3 identify-larva — adicionar verificação de cliente

Seguir o padrão de `triagem-ia-pos-voo`:
```typescript
// Adicionar após validar JWT
const { data: podeAcessar } = await supabase.rpc('usuario_pode_acessar_cliente', {
  p_cliente_id: clienteId
});
if (!podeAcessar) return new Response('Forbidden', { status: 403 });
```

---

## 6. PLANO DE CORREÇÃO PRIORIZADO

### Prioridade 1 — IMEDIATO (bloqueio de dados em produção)

- [ ] Adicionar `cliente_id` em `api.vistorias.listByImovel()`
- [ ] Adicionar `cliente_id` em `api.focosRisco.getById()`
- [ ] Adicionar `cliente_id` em `api.focosRisco.byLevantamentoItem()`
- [ ] Adicionar `.is('deleted_at', null)` em `focosRisco.getById()`
- [ ] Corrigir query key em `useFocosRisco` (objeto → primitivos)
- [ ] Adicionar mutex em `drainQueue()`

### Prioridade 2 — CURTO PRAZO (dados mobile chegando)

- [ ] Migration: `idempotency_key` em `vistorias` e `vistoria_depositos`
- [ ] Frontend: enviar `idempotency_key` no payload de sync
- [ ] Implementar retry com backoff exponencial (max 3 tentativas)
- [ ] Implementar dead letter queue para operações permanentemente falhas
- [ ] UI: tela de "sync pendente" para o agente ver/retentar falhas

### Prioridade 3 — MÉDIO PRAZO (segurança)

- [ ] `verify_jwt = true` em `cloudinary-upload-image` e `health-check`
- [ ] Verificação de cliente em `identify-larva` e `geocode-regioes`
- [ ] Migration QW-10D: `deleted_at` em módulo de vistoria

### Prioridade 4 — ARQUITETURA (SaaS escalável)

- [ ] Reduzir `pageSize: 200` para 50 com paginação incremental em GestorFocos
- [ ] Centralizar filtro `deleted_at` em RLS (evitar depender do frontend)
- [ ] Adicionar `offline_sync_log` com campos: `idempotency_key`, `payload_resumo`, `retry_count`
- [ ] Auditar todos os métodos de `api.ts` para `cliente_id` obrigatório

---

## 7. ARQUITETURA — MELHORIAS RECOMENDADAS

### 7.1 Centralizar deleted_at no RLS (não no frontend)

Atualizar as RLS policies para incluir `AND (deleted_at IS NULL OR deleted_at > now())` diretamente. Isso remove a responsabilidade do frontend e garante consistência em 100% das queries.

### 7.2 View consolidada para mapa

Criar `v_focos_mapa` com todos os filtros necessários (deleted_at, cliente_id, status ativos) para que o GestorMapa faça uma query simples sem lógica de filtragem.

### 7.3 Tabela de dead letter queue

```sql
CREATE TABLE offline_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  usuario_id uuid,
  operacao text,
  payload jsonb,
  idempotency_key uuid,
  erro text,
  retry_count int,
  created_at timestamptz DEFAULT now()
);
```

### 7.4 Observabilidade de sync

Criar dashboard admin `AdminSyncHealth` mostrando:
- Operações pendentes na fila por agente
- Operações na dead letter queue
- Taxa de sucesso de sync nas últimas 24h
- Latência média de sync

---

## APÊNDICE — Arquivos Críticos para Correção

| Arquivo | Problema | Prioridade |
|---|---|---|
| `src/services/api.ts:1684` | listByImovel sem cliente_id | P1 |
| `src/services/api.ts:2870` | getById sem cliente_id nem deleted_at | P1 |
| `src/services/api.ts:2983` | byLevantamentoItem sem cliente_id | P1 |
| `src/hooks/queries/useFocosRisco.ts:11` | query key instável | P1 |
| `src/lib/offlineQueue.ts` | sem mutex, sem idempotência, sem retry | P1/P2 |
| `src/pages/gestor/GestorFocos.tsx:38` | pageSize: 200 hardcoded | P4 |
| `supabase/config.toml` | verify_jwt = false em funções críticas | P3 |
| `supabase/functions/cloudinary-upload-image` | sem auth | P3 |
| `supabase/functions/health-check` | expõe config sensível | P3 |
| `supabase/functions/identify-larva` | sem verificação de cliente | P3 |
