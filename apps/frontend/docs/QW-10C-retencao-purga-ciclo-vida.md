# QW-10C — Retenção de Logs, Purga Segura e Ciclo de Vida dos Dados

> **Tipo:** Implementação técnica
> **Status:** Implementado
> **Migration:** `supabase/migrations/20260722000000_qw10c_retencao_logs.sql`
> **Depende de:** QW-10A (soft delete), QW-10B (cloudinary_orfaos)

---

## 1. Contexto

A auditoria QW-10 identificou que o banco crescia ilimitadamente em tabelas de log técnico e histórico operacional, sem nenhuma política que distinguisse o que é probatório (permanente) do que é debug temporário (purgável).

Esta etapa não apaga dados — ela **define e instrumenta** a política, preparando o ambiente para purgas seguras e auditáveis.

---

## 2. Matriz de Retenção

| Tabela | Classificação | Política | Justificativa |
|--------|--------------|----------|---------------|
| `foco_risco_historico` | Histórico permanente | **PERMANENTE** | Ledger de vigilância epidemiológica (saúde pública). Comment já dizia "NUNCA DELETE". |
| `levantamento_item_status_historico` | Histórico permanente | **PERMANENTE** (mín. 5 anos) | Trilha de auditoria de focos atendidos — valor probatório em ações judiciais/fiscalizações. |
| `sla_config_audit` | Auditoria de configuração | **PERMANENTE** (mín. 5 anos) | Alterações de SLA têm implicações contratuais entre prefeitura e plataforma. |
| `item_notificacoes_esus` | Log de integração — dado sensível | **5 anos** | Notificação compulsória (Lei 6.259/1975). `resposta_api` nullificada após 90 dias. |
| `unidades_saude_sync_controle` | Log operacional | **1 ano** | Sumário de cada sync CNES — valor para auditoria de integração, sem uso após 1 ano. |
| `levantamento_analise_ia` | Log analítico | **2 anos** | Resultado de triagem IA pós-voo. `clusters` (coordenadas+scores) nullificado após 1 ano. |
| `sla_erros_criacao` | Log técnico | **90 dias** | Debug de falhas de trigger SLA. Sem valor probatório de longo prazo. |
| `offline_sync_log` | Log técnico | **90 dias** | Debug de falhas de sincronização offline. Dados operacionais transitórios. |
| `unidades_saude_sync_log` | Log técnico detalhado | **90 dias** | Log linha-a-linha de sync CNES. O resumo em `sync_controle` é preservado por 1 ano. |
| `cloudinary_orfaos` | Fila de limpeza | **5 anos** (padrão QW-10B) | Já tratado na QW-10B com `retention_until`. |

---

## 3. Riscos Identificados

### 3.1 Dados sensíveis em logs

| Tabela | Campo | Risco | Ação |
|--------|-------|-------|------|
| `item_notificacoes_esus` | `resposta_api` | **ALTO** — resposta bruta da API e-SUS pode conter dados de saúde | Nullificado após 90 dias via `fn_redact_sensitive_log_fields` |
| `item_notificacoes_esus` | `payload_enviado` | **MÉDIO** — payload com doença, CNES, semana epidemiológica | Preservado 5 anos (notificação compulsória) |
| `levantamento_analise_ia` | `clusters` | **BAIXO** — coordenadas geográficas + scores YOLO | Nullificado após 1 ano via `fn_redact_sensitive_log_fields` |
| `offline_sync_log` | `erro` | **BAIXO** — mensagens de erro podem conter fragmentos de payload | Purgado em 90 dias |

### 3.2 Crescimento estimado sem purga

| Tabela | Linhas/ano (estimativa) | Tamanho estimado |
|--------|------------------------|-----------------|
| `foco_risco_historico` | ~5.000/prefeitura | 2 MB/prefeitura/ano |
| `levantamento_item_status_historico` | ~20.000/prefeitura | 5 MB/prefeitura/ano |
| `unidades_saude_sync_log` | ~15.000/prefeitura | 3 MB/prefeitura/ano |
| `offline_sync_log` | Variável (campo) | 1–10 MB/ano |
| `sla_erros_criacao` | < 500/prefeitura | Negligível |

---

## 4. Implementação

### 4.1 Colunas `retention_until` adicionadas

```sql
-- 90 dias
sla_erros_criacao.retention_until
offline_sync_log.retention_until
unidades_saude_sync_log.retention_until

-- 1 ano
unidades_saude_sync_controle.retention_until

-- 2 anos
levantamento_analise_ia.retention_until
levantamento_analise_ia.clusters_redacted_at  -- novo: rastreia quando clusters foi nullificado

-- 5 anos
item_notificacoes_esus.retention_until
item_notificacoes_esus.resposta_redacted_at    -- novo: rastreia quando resposta_api foi nullificada
```

Backfill calculado a partir de `created_at` / `criado_em` para registros existentes.

### 4.2 Função de redação de campos sensíveis

```sql
SELECT public.fn_redact_sensitive_log_fields(dry_run := true);
```

Retorna JSON com contagem de registros que seriam redatados:
- `esus_resposta_api` — `item_notificacoes_esus.resposta_api` com mais de 90 dias
- `analise_ia_clusters` — `levantamento_analise_ia.clusters` com mais de 1 ano

**Não apaga registros.** Apenas nullifica o campo específico e registra `*_redacted_at`.

### 4.3 Função de purga de logs expirados

```sql
-- Inspecionar primeiro
SELECT public.fn_purge_expired_logs(dry_run := true);

-- Aplicar
SELECT public.fn_purge_expired_logs(dry_run := false);
```

Retorna JSON com contagem por tabela e total de registros removidos.

**Nunca toca em:** `foco_risco_historico`, `levantamento_item_status_historico`, `sla_config_audit`.

### 4.4 View de monitoramento

```sql
SELECT * FROM public.v_retencao_logs_resumo;
```

Exibe: tabela, política, total de registros, expirados, próximo a expirar.

---

## 5. Operação Recomendada

### Rotina sugerida (Edge Function ou pg_cron)

```
Diariamente, 02h00 UTC:
  1. SELECT fn_redact_sensitive_log_fields(false)  → nullifica campos sensíveis
  2. SELECT fn_purge_expired_logs(false)           → purga registros expirados
  3. Logar resultado em tabela de observabilidade (opcional)
```

### Protocolo de segurança antes de cada purga

1. Executar sempre `dry_run=true` primeiro
2. Validar contagens via `v_retencao_logs_resumo`
3. Verificar que nenhuma tabela permanente aparece na purga
4. Só então executar com `dry_run=false`

---

## 6. O que NÃO foi feito (e por quê)

| Item | Decisão |
|------|---------|
| Purga em `foco_risco_historico` | **Recusada** — ledger probatório, equivalente a um livro de registro oficial |
| Purga em `levantamento_item_status_historico` | **Recusada** — pode ser requerido em fiscalização epidemiológica |
| Anonimização de `casos_notificados` | **Fora do escopo QW-10C** — requer análise jurídica separada; CLAUDE.md já documenta que não há CPF/nome |
| pg_cron configurado automaticamente | **Deixado para operação** — Supabase Pro requer configuração manual de cron jobs |
| Notificação de purga ao admin | **Fora do escopo** — pode ser implementado como extensão do relatorio-semanal |

---

## 7. Referências

- QW-10A: `docs/QW-10-auditoria-backup-retencao-lgpd.md`
- QW-10B: `docs/QW-10B-governanca-arquivos-orfaos-retencao.md`
- Lei 6.259/1975 — Notificação compulsória de doenças
- LGPD Art. 16 — Término do tratamento de dados
- Supabase pg_cron: disponível no plano Pro
