# QW-13 — Filas, processamento assíncrono e jobs pesados

## Objetivo

Separar processos pesados ou demorados do fluxo operacional síncrono, garantindo que o usuário não espere por tarefas que podem rodar em background. A infraestrutura deve ser simples, idempotente e resiliente.

---

## Classificação dos processos da plataforma

| Processo | Duração típica | Classificação | Ação tomada |
|---|---|---|---|
| Triagem IA pós-voo | 10–30s | **Deve ser assíncrono** | ✅ Migrado para job_queue |
| Sync CNES | 5–60s | **Deve ser assíncrono** | ✅ Suportado como job `cnes_sync` |
| Relatório semanal | 3–10s | Pode ser assíncrono | ✅ Suportado como job `relatorio_semanal` |
| Limpeza de retenção | 1–5s | Pode ser assíncrono | ✅ Suportado como job `limpeza_retencao` |
| Cloudinary cleanup | 1–5s | Pode ser assíncrono | ✅ Suportado como job `cloudinary_cleanup` |
| Health check | < 2s | Síncrono OK | Mantido direto, também suportado como job |
| SLA marcar vencidos | < 1s | Síncrono obrigatório | Mantido como cron próprio |
| Upload de evidência | < 3s | Síncrono obrigatório | Mantido (feedback imediato ao operador) |
| Geocodificação | < 2s | Síncrono obrigatório | Mantido |
| Push SLA crítico | < 1s | Síncrono obrigatório | Mantido |

---

## Arquitetura

```
Frontend (api.jobQueue.enqueue)
    │
    ▼
fn_enqueue_job (RPC SECURITY DEFINER)
    │
    ▼
job_queue (tabela PostgreSQL)
    │
    ▼  cron: */1 * * * *
job-worker (Edge Function)
    │
    ├── fn_claim_next_job() — FOR UPDATE SKIP LOCKED
    │
    ├── Handlers por tipo:
    │   ├── triagem_ia        → invoke triagem-ia-pos-voo
    │   ├── relatorio_semanal → invoke relatorio-semanal
    │   ├── cnes_sync         → fetch cnes-sync
    │   ├── limpeza_retencao  → invoke limpeza-retencao-logs
    │   ├── cloudinary_cleanup→ invoke cloudinary-cleanup-orfaos
    │   └── health_check      → invoke health-check
    │
    └── Resultado → job_queue (status, resultado, erro)
                  → system_alerts (se falhar definitivamente)
```

### Concorrência segura

O worker usa `FOR UPDATE SKIP LOCKED` via `fn_claim_next_job()`, o que garante que invocações simultâneas do cron nunca processem o mesmo job. Cada chamada ao worker processa até 5 jobs por vez (limite de timeout de 30s da Edge Function).

---

## Tabela `job_queue`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `tipo` | text | Tipo do job (veja lista acima) |
| `payload` | jsonb | Parâmetros para o handler |
| `status` | text | `pendente` → `em_execucao` → `concluido` / `falhou` / `cancelado` |
| `tentativas` | int | Número de execuções já realizadas |
| `max_tentativas` | int | Máximo de tentativas (default: 3) |
| `executar_em` | timestamptz | Não executar antes deste momento (usado no backoff) |
| `iniciado_em` | timestamptz | Quando o worker clamou o job |
| `concluido_em` | timestamptz | Quando o job foi finalizado |
| `resultado` | jsonb | Dados retornados pelo handler (sucesso) |
| `erro` | text | Última mensagem de erro |

### State machine

```
pendente ──► em_execucao ──► concluido
                │
                ├── (tentativas < max) ──► pendente (com backoff)
                │
                └── (tentativas >= max) ──► falhou
                                              │
                                              └── retry manual ──► pendente
```

### Backoff exponencial

| Tentativa | Aguarda antes do próximo retry |
|---|---|
| 1 | 2 minutos |
| 2 | 4 minutos |
| 3+ | 8, 16, 32, 60 minutos (máximo) |

---

## Tipos de job e payloads

### `triagem_ia`
```json
{ "levantamento_id": "uuid", "cliente_id": "uuid" }
```
Invoca `triagem-ia-pos-voo`. Resultado persiste em `levantamento_analise_ia`.

### `relatorio_semanal`
```json
{ "cliente_id": "uuid" }  // ou {} para todos os clientes
```
Invoca `relatorio-semanal`.

### `cnes_sync`
```json
{ "cliente_id": "uuid" }
```
Invoca `cnes-sync` com `origem: "job_worker"`.

### `limpeza_retencao`
```json
{ "apenas_redact": false }  // payload opcional
```
Invoca `limpeza-retencao-logs` com `dry_run: false`.
⚠️ **Atenção**: este job executa purge real. Nunca enfileirar em teste sem `dry_run: true` (mas o worker sempre força `dry_run: false` — criar job apenas quando necessário).

### `cloudinary_cleanup`
```json
{}  // ou { "cliente_id": "uuid" } para um cliente específico
```

### `health_check`
```json
{}
```

---

## Como enfileirar um job

### Via código (api.ts)

```typescript
import { api } from '@/services/api';

// Enfileirar triagem IA
const jobId = await api.jobQueue.enqueue('triagem_ia', {
  levantamento_id: levId,
  cliente_id: clienteId,
});

// Acompanhar status
const job = await api.jobQueue.get(jobId);
```

### Via hook React

```typescript
import { useEnqueueJobMutation, useJob } from '@/hooks/queries/useJobQueue';

const enqueue = useEnqueueJobMutation();
const { data: job } = useJob(jobId); // polling automático enquanto ativo
```

### Via SQL (admin/debug)

```sql
SELECT fn_enqueue_job('health_check', '{}');
SELECT * FROM job_queue ORDER BY criado_em DESC LIMIT 10;
```

---

## Monitoramento

- **`/admin/job-queue`** — tela admin com KPIs, lista de jobs, retry/cancel
- **`system_alerts`** — alerta gerado automaticamente quando um job falha definitivamente
- **Polling automático** — `useJobQueue` faz refetch a cada 10s quando há jobs ativos; `useJob` a cada 5s

---

## RLS

| Operação | Quem pode |
|---|---|
| SELECT | `admin`, `supervisor` |
| UPDATE (cancelar) | `admin` |
| INSERT | service_role (worker) ou via `fn_enqueue_job` (SECURITY DEFINER) |

---

## Configuração de cron (Supabase Dashboard)

```
Edge Function: job-worker
Cron expression: */1 * * * *   (a cada minuto)
```

O worker processa até 5 jobs por invocação. Com cron de 1 minuto e jobs levando ~10s cada, a capacidade é de ~300 jobs/hora em regime normal.

---

## Próximos candidatos a migrar

| Processo | Motivo |
|---|---|
| `cnes_sync` chamado pelo admin | Já suportado, migrar o botão "Sincronizar agora" para enqueue |
| `relatorio_semanal` cron existente | Substituir o cron próprio pelo job_queue para ter histórico |
| `limpeza_retencao` cron existente | Idem — job_queue oferece auditoria e retry |

---

## Decisões arquiteturais

- **PostgreSQL como fila**: simples, sem dependência extra, funciona com RLS e PITR. Para volumes > 10k jobs/hora, avaliar Redis ou pgmq.
- **Máximo de 5 jobs por invocação**: evita timeout de 30s. Ajustar `MAX_JOBS` no worker se os handlers forem rápidos.
- **`dry_run: false` forçado no worker**: o worker nunca executa em modo simulação — a decisão de purge real é implícita no ato de enfileirar o job.
- **`fn_enqueue_job` SECURITY DEFINER**: permite que qualquer usuário autenticado (admin/supervisor) enfileire jobs sem precisar de política RLS de INSERT — mas a validação do tipo é feita na função.
