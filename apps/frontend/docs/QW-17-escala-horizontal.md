# SENTINELLA WEB — QW-17
# Diagnóstico de Escala Horizontal e Preparação para Crescimento

**Status:** Diagnóstico concluído
**Data:** 2026-03-27
**Escopo:** Análise arquitetural sem implementação imediata

---

## 1. O que já está preparado para escala

| Componente | Por que ajuda | Referência |
|---|---|---|
| RLS com `cliente_id` em todas as tabelas | Isolamento multi-tenant correto desde a fundação | Todas as migrations |
| Índices em `cliente_id` nas tabelas principais | Queries filtradas por tenant são eficientes | migrations 20250301+ |
| `job_queue` com `FOR UPDATE SKIP LOCKED` | Claiming atômico sem race condition entre workers | QW-13 |
| Retry + backoff no job-worker | Resiliente a falhas de integrações externas | QW-13 |
| Fila offline IndexedDB + drain | Operadores de campo independentes de conectividade | `offlineQueue.ts` |
| Edge Functions especializadas (17) | Sem monolito de processamento — cada responsabilidade isolada | `supabase/functions/` |
| `billing_usage_snapshot` imutável | Histórico de uso mensal sem reprocessamento | QW-15 |
| `quota_enforcement` via trigger no banco | Limites aplicados mesmo se frontend contornar | QW-16 |
| `STALE.*` constants — cache configurável | Controle fino de staleness por tipo de dado | `queryConfig.ts` |
| Soft delete com `deleted_at` | Histórico preservado, queries não scanam lixo | QW-10A |

---

## 2. Banco de Dados

### 2.1 Tabelas mais quentes (hotspots de escrita)

| Tabela | Volume estimado/cliente/mês | Padrão de acesso | Risco |
|---|---|---|---|
| `levantamento_itens` | 1.000–50.000 registros | INSERT em lote pós-voo, SELECT por mapa | 🔴 ALTO — cresce sem limite |
| `vistorias` | 500–3.000/mês | INSERT frequente em campo (mobile) | 🟡 MÉDIO |
| `vistoria_depositos` | 2.500–15.000/mês | INSERT múltiplos por vistoria | 🟡 MÉDIO |
| `job_queue` | 200–2.000/mês | INSERT + UPDATE em polling | 🟢 BAIXO com purga |
| `audit_log` | 1.000–10.000/mês | INSERT append-only | 🟡 MÉDIO com purga |
| `canal_cidadao_rate_limit` | 500–5.000/mês | INSERT + SELECT por IP hash | 🟢 BAIXO com TTL |
| `system_health_log` | 2.880/mês (30min × 24h × 4) | INSERT periódico, SELECT recente | 🟢 BAIXO com purga |

### 2.2 Gargalos do Postgres/PostGIS

**Consultas espaciais (`ST_DWithin`)**
- Usadas em: `trigger trg_cruzar_caso_focos`, RPC `listar_casos_no_raio`, `contar_casos_proximos_ao_item`
- Dependem de índice GIST em `(latitude, longitude)` ou coluna `geometry`
- Sem o índice GIST, cada insert em `casos_notificados` faz full scan de `levantamento_itens` — O(n²) com crescimento de casos
- **Ação imediata**: verificar existência do índice GIST nas tabelas com coordenadas

**RPC `cliente_verificar_quota`**
- Chamada frequente (antes de triagem IA, criação de usuário, levantamento)
- Executa 1 SELECT por métrica — aceitável hoje, mas pode virar hotspot com 100+ verificações/min
- **Preparação**: materializar uso mensal em view materializada com refresh a cada 5min (para 50+ clientes)

**View `v_cliente_uso_mensal`**
- Correlated subqueries para 7 métricas — calculada on-demand a cada acesso
- Com 50+ clientes, cada acesso a `AdminQuotas` dispara 7 subqueries × N clientes
- **Preparação**: converter para `MATERIALIZED VIEW` com `REFRESH CONCURRENTLY` a cada 5min via cron

**`levantamento_itens` sem particionamento**
- Tabela de crescimento linear ilimitado, filtrada quase sempre por `cliente_id` + `created_at`
- Com 50+ clientes e voos frequentes, pode superar 1M de linhas em 12 meses
- **Preparação**: índice composto antes de atingir 500K; particionamento por `(cliente_id, ano_mes)` antes de 2M

### 2.3 Contenção de escrita

Cenários de contenção identificados:

| Cenário | Causa | Mitigação |
|---|---|---|
| Múltiplos operadores de campo sincronizando ao mesmo tempo | INSERT concorrente em `vistorias` + `vistoria_depositos` | Sem lock — cada linha é independente; sem contenção real |
| Trigger `trg_cruzar_caso_focos` após cada INSERT em `casos_notificados` | Trigger síncrono com ST_DWithin scan | Converter para job assíncrono se latência de inserção aumentar |
| `check_quota_*` triggers em INSERT de `levantamentos`/`usuarios` | SELECT + check por trigger antes de cada INSERT | Aceitável até 100 INSERTs/min; monitorar |
| `billing-snapshot` rodando para todos os clientes no dia 1 do mês | UPDATE em massa em `billing_ciclo` | Já ok — backoff por cliente com transações individuais |

### 2.4 Necessidade de Read Replica

**Quando considerar:** 50+ clientes ativos com relatórios lentos.

**Carga candidata a read replica:**
- `relatorio-semanal` Edge Function (segunda-feira 08h — pico)
- `AdminHeatmapTemporal` — agregações por semana
- `AdminPainelMunicipios` — comparativo multi-cliente
- `v_billing_resumo` — join pesado
- Exportações CSV em AdminQuotas, AdminSla

**O que DEVE ficar na primary:** toda escrita operacional, triggers, RLS com `auth.uid()`.

### 2.5 Particionamento futuro

| Tabela | Estratégia | Threshold |
|---|---|---|
| `levantamento_itens` | RANGE por `(created_at)` mensal + índice por `cliente_id` | > 1M linhas |
| `audit_log` | RANGE por `created_at` mensal | > 500K linhas |
| `system_health_log` | RANGE por `created_at` semanal | > 200K linhas |
| `job_queue` (histórico) | Mover concluídos para tabela de arquivo após 90 dias | > 500K linhas |

---

## 3. Job Queue e Workers

### 3.1 Arquitetura atual

```
job-worker (cron */1 * * * *)
  └── fn_claim_next_job() — FOR UPDATE SKIP LOCKED
      └── processa 1 job por execução
          └── chama Edge Function específica por tipo
```

**6 tipos de job:** `triagem_ia`, `relatorio_semanal`, `cnes_sync`, `limpeza_retencao`, `cloudinary_cleanup`, `health_check`

### 3.2 Riscos de starvation

| Risco | Cenário | Impacto |
|---|---|---|
| **Cliente grande bloqueia fila** | Cliente A cria 50 jobs de triagem IA — cliente B espera | Latência inaceitável para B |
| **Job pesado atrasa jobs leves** | `relatorio_semanal` (60s) antes de `health_check` (2s) | Monitoramento atrasado |
| **Worker não escalável** | 1 execução/minuto processa 1 job — backlog acumula | Com 50 clientes, backlog pode crescer > 30min |
| **Falha em job IA consome todos os retries** | Claude API indisponível — 3 retries × N jobs = slot travado | Outros jobs atrasam |

### 3.3 Throughput atual vs necessário

| Cenário | Jobs/dia estimados | Capacidade atual (1/min) | Suficiente? |
|---|---|---|---|
| 10 clientes | ~200 jobs/dia | 1440 slots/dia | ✅ |
| 50 clientes | ~1.000 jobs/dia | 1440 slots/dia | ✅ apertado |
| 200 clientes | ~4.000 jobs/dia | 1440 slots/dia | ❌ backlog acumula |
| 500 clientes | ~10.000 jobs/dia | 1440 slots/dia | ❌ inviável |

### 3.4 Melhorias necessárias por cenário

**Antes de 30 clientes (round-robin por cliente):**
```typescript
// job-worker: buscar 1 job de cada cliente com pendências, não 1 global
// Evita starvation de clientes pequenos quando cliente grande tem fila grande
const jobs = await supabase.rpc('fn_claim_jobs_round_robin', { p_max: 5 });
await Promise.allSettled(jobs.map(processarJob));
```

**Antes de 100 clientes (filas por peso):**

| Fila | Tipos | Worker | Concorrência |
|---|---|---|---|
| `fila_critica` | health_check, sla | Dedicado | 10/min |
| `fila_ia` | triagem_ia | Dedicado | 2/min (API externa) |
| `fila_pesada` | relatorio_semanal | Dedicado | 3/min |
| `fila_sync` | cnes_sync, cloudinary_cleanup | Dedicado | 5/min |
| `fila_manutencao` | limpeza_retencao | Compartilhado | 10/min |

**Retry por tipo (configurar no banco):**
- `triagem_ia` → max_retries=3, backoff 5min (API externa pode estar lenta)
- `cnes_sync` → max_retries=5, backoff 15min (DATASUS tem instabilidade conhecida)
- `limpeza_retencao` → max_retries=1 (idempotente, safe de re-executar)

---

## 4. Edge Functions — Análise de Saturação

### 4.1 Classificação por risco

| Edge Function | Tipo | Dependência externa | Risco de saturação | Isolamento futuro |
|---|---|---|---|---|
| `triagem-ia-pos-voo` | Pesada + IA | Anthropic API | 🔴 ALTO | Alta prioridade |
| `relatorio-semanal` | Pesada | Resend API | 🟡 MÉDIO (pico segunda) | Média prioridade |
| `cnes-sync` | Pesada | DATASUS API | 🟡 MÉDIO (instável) | Média prioridade |
| `billing-snapshot` | Média | — | 🟢 BAIXO (1x/mês) | Não necessário |
| `job-worker` | Orquestrador | Todas acima | 🔴 ALTO (gargalo único) | Alta prioridade |
| `pluvio-risco-daily` | Média | API clima | 🟡 MÉDIO | Baixa prioridade |
| `sla-marcar-vencidos` | Leve | — | 🟢 BAIXO | Não necessário |
| `health-check` | Leve | — | 🟢 BAIXO | Não necessário |
| `cloudinary-upload-image` | Média | Cloudinary | 🟡 MÉDIO (upload concorrente) | Baixa prioridade |
| `cloudinary-cleanup-orfaos` | Leve | Cloudinary | 🟢 BAIXO | Não necessário |
| `upload-evidencia` | Média | Cloudinary | 🟡 MÉDIO | Baixa prioridade |
| `sla-push-critico` | Leve | Web Push API | 🟢 BAIXO | Não necessário |
| `limpeza-retencao-logs` | Leve | — | 🟢 BAIXO | Não necessário |
| `identify-larva` | Pesada + IA | API externa | 🔴 ALTO | Alta prioridade |
| `geocode-regioes` | Leve | Nominatim | 🟢 BAIXO (manual) | Não necessário |
| `resumo-diario` | Média | — | 🟡 MÉDIO | Baixa prioridade |

### 4.2 Timeout e limites do Deno/Supabase

- Limite por padrão: 150s de CPU por invocação
- `triagem-ia-pos-voo` com 500+ itens pode aproximar este limite
- **Ação**: para levantamentos grandes, chunkar processamento em lotes de 50 itens e agregar
- **Ação**: `cnes-sync` com muitas unidades pode timeout — já tem retry, mas adicionar checkpoint de retomada

### 4.3 Dependências externas críticas

| Integração | SLA externo | Risco | Mitigação atual |
|---|---|---|---|
| Anthropic Claude | 99.5% | Indisponibilidade paralisa IA | Job retry 3x ✅ |
| DATASUS/CNES | ~95% | Sync falhará com frequência | Retry 5x sugerido |
| Resend | 99.9% | Relatório semanal não enviado | Job retry ✅ |
| Cloudinary | 99.9% | Upload de evidência falha | Retry via offlineQueue ✅ |
| API clima | ~98% | Risco pluvial com dado desatualizado | Fallback para último dado ✅ |

---

## 5. Frontend e Mapas

### 5.1 Gargalos por tela

| Tela | Gargalo | Gatilho | Solução |
|---|---|---|---|
| `AdminHeatmapTemporal` | Carrega todos os itens de N semanas | Cliente com 10+ levantamentos | Paginar por semana; max 1.000 pontos/semana |
| `OperadorMapa` | Todos os imóveis do agente no viewport | Cliente com 5.000+ imóveis | Viewport filtering — só carregar o que está visível |
| `AdminMapaComparativo` | 2 levantamentos completos simultâneos | Levantamentos com 1.000+ itens | Sampling automático acima de 500 pontos |
| `AdminPainelMunicipios` | Dados de todos os clientes em paralelo | 50+ clientes | Paginação; load sob demanda |
| `AdminCasosNotificados` | Tabela sem paginação de backend | Clientes com muitos casos | Cursor-based pagination |
| `ItemDetailPanel` | Consulta de casos próximos a cada abertura | Uso intenso do painel | Cache por item_id com `STALE.SHORT` |

### 5.2 Volume por cliente — thresholds

| Métrica | Seguro | Atenção | Crítico |
|---|---|---|---|
| Itens por levantamento | < 500 | 500–2.000 | > 2.000 |
| Levantamentos por cliente | < 20 | 20–100 | > 100 |
| Imóveis cadastrados | < 5.000 | 5.000–20.000 | > 20.000 |
| Casos notificados | < 1.000 | 1.000–5.000 | > 5.000 |

### 5.3 O que já está bem

- Lazy loading de páginas via `safeLazy()` — chunks separados por rota ✅
- `STALE.MAP = 10min` para dados cartográficos ✅
- `HeatmapLayer` com clustering no frontend ✅
- TSP nearest-neighbor no `OperadorMapa` — cálculo local, não vai ao banco ✅
- `usePagination` em tabelas admin ✅

### 5.4 Quick wins disponíveis

**Viewport filtering (sem mudança de backend):**
Filtrar `levantamento_itens` pelo bounding box visível do mapa antes de renderizar — reduz de 5.000 para ~200 pontos na maioria dos casos.

**Cursor pagination nas tabelas grandes:**
`AdminCasosNotificados`, `AdminSla` — trocar `range(0, 50)` por cursor em `id` para não degradar com volume.

---

## 6. Storage e Imagens

### 6.1 Cloudinary — análise atual

| Aspecto | Estado atual | Risco |
|---|---|---|
| Upload de evidência | Edge Function `upload-evidencia` — síncrono | 🟡 — conexão ruim no campo = timeout |
| Upload de imagem drone | Edge Function `cloudinary-upload-image` | 🟡 — grandes lotes pós-voo |
| MIME validation | ✅ (QW-14) — whitelist + limite 8MB | ✅ |
| Cleanup de órfãos | Edge Function `cloudinary-cleanup-orfaos` + job | ✅ |
| Transformações | Não usamos transformações dinâmicas ainda | 🟢 |

### 6.2 Impacto de upload simultâneo

Com operadores em campo sincronizando ao mesmo tempo:
- Cada vistoria pode ter 1–3 fotos de evidência
- 20 operadores × 3 fotos = 60 uploads simultâneos
- Cloudinary suporta concorrência alta, mas a Edge Function tem limite de execuções simultâneas no Supabase
- **Risco real**: throttling do Supabase (não do Cloudinary) em picos de sync

**Mitigação já existente:** `offlineQueue.ts` drena sequencialmente, não em paralelo — upload é serializado por operador.

### 6.3 Limites operacionais

| Plano Cloudinary | Storage | Transformações | Bandwidth |
|---|---|---|---|
| Free | 25 GB | 25 créditos/mês | 25 GB |
| Plus (~$89/mês) | 225 GB | 225 créditos/mês | 225 GB |
| Advanced | Custom | Custom | Custom |

**Estimativa por cliente/mês:** 0.5–2 GB de imagens.
- 10 clientes → 5–20 GB → Free é insuficiente para produção
- 50 clientes → 25–100 GB → Plus necessário
- 200 clientes → 100–400 GB → Advanced

---

## 7. Cenários de Escala

### 7.1 — 10 clientes (estágio atual)

| Camada | Estado | Ação necessária |
|---|---|---|
| Banco | Estável | Verificar índices GIST |
| Jobs | 1 worker suficiente | Nenhuma |
| Edge Functions | Sem saturação | Nenhuma |
| Frontend | Rápido | Nenhuma |
| Storage | < 20 GB | Migrar para Cloudinary Plus |

### 7.2 — 50 clientes

| Camada | Risco | Ação necessária |
|---|---|---|
| Banco | `v_cliente_uso_mensal` lento | Converter para materialized view |
| Jobs | Starvation por cliente grande | Round-robin no job-worker |
| Relatórios | 50 relatórios segunda 8h UTC | Distribuir por offset de cliente |
| Frontend | AdminPainelMunicipios lento | Paginação sob demanda |
| Storage | 25–100 GB | Cloudinary Plus |
| Conexões | 250–500 conexões | Verificar PgBouncer config Supabase |

### 7.3 — 200 clientes

| Camada | Risco | Ação necessária |
|---|---|---|
| Banco | `levantamento_itens` > 1M linhas | Índice composto; planejar particionamento |
| Jobs | Backlog cresce 1.000+/dia | Filas separadas por peso |
| Edge Functions | `triagem-ia-pos-voo` pode timeout | Chunkar por 50 itens |
| Frontend | Telas de comparativo muito lentas | Sampling automático |
| Storage | 100–400 GB | Cloudinary Advanced |
| Supabase | Shared compute esticado | Avaliar plano Pro dedicado |

### 7.4 — 500 clientes

| Camada | Risco | Ação necessária |
|---|---|---|
| Banco | Custo e latência críticos | Read replica para relatórios; particionamento |
| Jobs | Inviável com 1 worker | Workers dedicados por tipo |
| IA (Claude) | Custo significativo por token | Cache agressivo; reutilizar análises similares |
| Storage | 250–1.000 GB | CDN para imagens; política de retenção mais rígida |
| Billing | Custo visível por cliente | QW-15/16 já preparam — usar dados para precificação |

---

## 8. Mapa de Gargalos por Urgência

| Gargalo | Urgência | Probabilidade de ocorrer | Trigger |
|---|---|---|---|
| `job-worker` sequencial — starvation | 🔴 ALTA | ALTA | 20+ clientes |
| `v_cliente_uso_mensal` calculada on-demand | 🟡 MÉDIA | ALTA | 50+ clientes |
| `levantamento_itens` sem particionamento | 🟡 MÉDIA | MÉDIA | 1M+ linhas |
| Trigger `trg_cruzar_caso_focos` síncrono | 🟡 MÉDIA | BAIXA | Pico de casos |
| Falta de índice GIST em tabelas espaciais | 🔴 ALTA | ALTA | Já deveria existir |
| Uploads simultâneos no pico de sync | 🟡 MÉDIA | MÉDIA | 20+ operadores |
| Relatórios Segunda 8h sem distribuição | 🟡 MÉDIA | ALTA | 50+ clientes |
| `cnes-sync` DATASUS sem retry adequado | 🟡 MÉDIA | ALTA | Já ocorre |
| Telas de mapa sem viewport filtering | 🟡 MÉDIA | ALTA | Clientes com >5k imóveis |
| Cursor pagination faltando em tabelas grandes | 🟢 BAIXA | MÉDIA | 10k+ registros/tabela |

---

## 9. Proposta Incremental

### Ação imediata (independente de crescimento)

| Item | Arquivo | Esforço |
|---|---|---|
| Verificar/criar índice GIST em `casos_notificados` e `levantamento_itens` | migration | Baixo |
| Round-robin no `job-worker` — 1 job por cliente ativo | `job-worker/index.ts` | Médio |
| Distribuir horário de relatórios por hash do `cliente_id` | `relatorio-semanal/index.ts` | Baixo |
| Cursor pagination em `AdminCasosNotificados` | Frontend | Baixo |

### Preparação arquitetural (sinalizar antes de implementar)

| Sinal | Ação |
|---|---|
| `v_cliente_uso_mensal` demorando > 500ms | Converter para MATERIALIZED VIEW |
| Job backlog > 30min para qualquer cliente | Implementar filas por peso |
| `levantamento_itens` > 500K linhas | Criar índice composto + planejar particionamento |
| Relatórios com timeout | Chunkar geração + read replica |
| Upload falhando > 5% das tentativas | Fila dedicada com retry exponencial |

### Problema de fase futura (não implementar ainda)

| O que | Por que esperar |
|---|---|
| Microserviços (IA, relatório, sync) | Edge Functions + job_queue são suficientes até 200+ clientes |
| Sharding horizontal de banco | Particionamento nativo do PostgreSQL resolve até escala muito alta |
| Redis/cache distribuído | React Query + view materializada resolvem a maioria dos casos |
| CDN próprio para imagens | Cloudinary já é CDN; transformações dedicadas só em escala grande |
| Elasticsearch para logs | PostgreSQL + JSONB + índice GIN é suficiente até 10M+ logs |

---

## 10. Consultas de Monitoramento

```sql
-- Tamanho das tabelas mais quentes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)), n_live_tup
FROM pg_stat_user_tables
WHERE relname IN (
  'levantamento_itens','vistorias','job_queue','audit_log','system_health_log','casos_notificados'
)
ORDER BY pg_total_relation_size(relid) DESC;

-- Verificar índices GIST existentes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE indexdef ILIKE '%gist%'
ORDER BY tablename;

-- Backlog da fila por cliente
SELECT cliente_id, tipo, COUNT(*) AS pendentes, MIN(created_at) AS mais_antigo
FROM job_queue WHERE status = 'pendente'
GROUP BY cliente_id, tipo
HAVING COUNT(*) > 5
ORDER BY mais_antigo;

-- Queries lentas (requer pg_stat_statements habilitado)
SELECT LEFT(query, 80), ROUND(mean_exec_time::numeric, 1) AS ms_medio, calls
FROM pg_stat_statements
WHERE mean_exec_time > 200
ORDER BY total_exec_time DESC
LIMIT 20;
```
