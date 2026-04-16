# QW-10D — Backup, Restore e Operação de Retenção

> **Tipo:** Runbook operacional
> **Status:** Implementado
> **Depende de:** QW-10A, QW-10B, QW-10C

---

## 1. Diagnóstico do Estado Atual

### 1.1 O que existe hoje

| Mecanismo | Status | Observação |
|-----------|--------|-----------|
| Backup diário automático Supabase | ❓ **A confirmar** | Disponível apenas no plano Pro+ |
| PITR (Point-in-Time Recovery) | ❓ **A confirmar** | Add-on no plano Pro — até 7 dias |
| pg_dump externo agendado | ✅ Implementado nesta etapa | `.github/workflows/backup-diario.yml` |
| Soft delete em tabelas críticas | ✅ QW-10A | `levantamento_itens`, `focos_risco`, `vistorias`, `casos_notificados` |
| Limpeza segura de arquivos Cloudinary | ✅ QW-10B | `cloudinary_orfaos` + Edge Function |
| Purga de logs por retenção | ✅ QW-10C | `fn_purge_expired_logs` + `fn_redact_sensitive_log_fields` |
| Rotina automática de retenção | ✅ Implementado nesta etapa | Edge Function `limpeza-retencao-logs` |
| Procedimento documentado de restore | ✅ Este documento | |

### 1.2 Lacunas operacionais identificadas

| # | Lacuna | Impacto | Ação necessária |
|---|--------|---------|-----------------|
| L1 | Plano Supabase não confirmado | Pode não ter backup automático | **Verificar agora no Dashboard** |
| L2 | PITR não confirmado como ativo | RPO de 24h em caso de falha | Ativar se plano permitir |
| L3 | Restore nunca foi testado | RTO real desconhecido | Executar drill anual |
| L4 | Sem destino de backup externo de longa retenção | Artifacts GitHub expiram em 30 dias | Configurar S3/R2 se necessário |
| L5 | Sem processo de notificação de falha de backup | Backup pode falhar silenciosamente | Configurar alerta GitHub Actions |

---

## 2. Capacidades por Plano Supabase

> ⚠️ Verificar o plano atual em: **Supabase Dashboard → Settings → Billing**

| Recurso | Free | Pro (US$25/mês) | Team (US$599/mês) |
|---------|------|-----------------|-------------------|
| Backup automático diário | ❌ | ✅ 7 dias | ✅ 14 dias |
| PITR (add-on) | ❌ | ✅ 7 dias — US$100/mês | ✅ 28 dias — incluído |
| Restore via Dashboard | ❌ | ✅ | ✅ |
| pg_cron (scheduled jobs) | ❌ | ✅ | ✅ |
| Logs de Edge Functions | 1 dia | 7 dias | 28 dias |
| Suporte | Comunidade | Email | Dedicado |

**Recomendação:** O Sentinella armazena dados de saúde pública (dengue, vigilância epidemiológica). O plano **Pro com PITR ativo** é o mínimo recomendado para operar prefeituras em produção.

---

## 3. RTO e RPO Recomendados

### Definições

- **RPO (Recovery Point Objective):** Quanto de dado o sistema pode perder no pior caso.
- **RTO (Recovery Time Objective):** Quanto tempo para o sistema voltar a operar após falha.

### Valores alvo para o Sentinella

| Cenário | RPO alvo | RTO alvo | Como atingir |
|---------|----------|----------|--------------|
| Falha de infraestrutura (Supabase down) | N/A | < 1h | Supabase SLA 99.9% — fora do controle |
| Corrupção ou perda de dados | < 24h | < 4h | pg_dump diário + Supabase backup Pro |
| Corrupção com PITR ativo | < 5 min | < 2h | PITR Supabase Pro ativo |
| Erro humano (delete acidental) | < 24h | < 2h | Soft delete QW-10A + restore seletivo |
| Erro humano em tabela permanente | N/A | < 2h | Restore do backup diário |

### O que depende de configuração (não de código)

- RPO < 24h → **ativar backup diário Pro no Dashboard**
- RPO < 5min → **contratar e ativar PITR no Dashboard**
- RTO < 2h → **executar drill de restore pelo menos 1x/ano**

---

## 4. Procedimento de Backup

### 4.1 Backup automático Supabase (se plano Pro)

**Verificar e configurar:**
1. Acessar Supabase Dashboard → **Settings → Backups**
2. Confirmar que "Daily backups" está ativado
3. Verificar retenção (7 dias no Pro)
4. Se PITR disponível: ativar em **Settings → Backups → Point in Time Recovery**

### 4.2 Backup externo via GitHub Actions

**Arquivo:** `.github/workflows/backup-diario.yml`

**Configurar secrets no GitHub** (Settings → Secrets and variables → Actions):

```
SUPABASE_DB_HOST      = db.<project-ref>.supabase.co
SUPABASE_DB_PASSWORD  = <senha postgres>
                        (Dashboard → Settings → Database → Database password)
```

**Execução:** Automática toda noite às 03:00 UTC. Para executar manualmente:

```
GitHub → Actions → "Backup Diário" → Run workflow
```

**Retenção:** 30 dias nos GitHub Artifacts. Para retenção maior (1 ano), ativar o upload S3 comentado no workflow.

**O que o backup exclui** (logs técnicos de retenção curta, não vale armazenar):
- `offline_sync_log` — purga em 90 dias, irrelevante no backup
- `unidades_saude_sync_log` — idem

---

## 5. Procedimento de Restore

> ⚠️ **Nunca restaurar diretamente em produção sem validar em staging primeiro.**

### 5.1 Restore via Supabase Dashboard — Perda ou Corrupção de Dados

**Cenário:** Perda de dados, corrupção, erro humano grave.

#### Passo 1 — Identificar o horário do problema

- Checar logs de Edge Functions no Dashboard (últimas transações antes da falha)
- Checar `git log` / deploys recentes — verificar se um deploy causou o problema
- Consultar usuários: "quando perceberam o problema pela primeira vez?"
- Anotar o **timestamp exato** do último estado bom conhecido

#### Passo 2 — Colocar o sistema em modo manutenção

Definir a variável de ambiente `VITE_MAINTENANCE_MODE=true` no projeto (Vercel/Netlify/host atual) e fazer redeploy, ou temporariamente bloquear o acesso via painel do host. O objetivo é evitar novas gravações que complicariam a reconciliação.

#### Passo 3 — Acessar o Supabase Dashboard

Navegar para: **app.supabase.com → projeto Sentinella → Database**

#### Passo 4 — Database → Backups

Abrir a aba **Backups** (ou **Settings → Backups** dependendo da versão do Dashboard).

#### Passo 5 — Selecionar o backup anterior ao incidente

- Com backup diário: escolher o snapshot imediatamente **anterior** ao timestamp identificado no Passo 1
- Com PITR ativo: usar **Point in Time Recovery** e informar o timestamp exato do último estado bom

> ⚠️ Não selecionar um backup mais antigo do que o necessário — quanto mais antigo, maior a perda de dados.

#### Passo 6 — Restaurar para um novo database (não sobrescrever direto)

O Supabase permite restaurar para um **novo projeto** ou branch de banco. **Nunca restaurar diretamente sobre o banco de produção ativo** sem validação prévia.

- Opção A (Supabase branching): criar um branch de banco e restaurar nele
- Opção B (projeto separado): criar um projeto Supabase temporário e usar `pg_restore` com o dump

#### Passo 7 — Validar o banco restaurado

Conectar ao banco restaurado e executar as verificações a seguir:

```sql
-- Número de clientes (deve bater com o esperado)
SELECT COUNT(*) FROM clientes WHERE ativo = true;

-- Últimas vistorias (verificar se a data mais recente faz sentido)
SELECT id, imovel_id, data_visita, status
FROM vistorias
ORDER BY created_at DESC
LIMIT 10;

-- Focos ativos por cliente
SELECT cliente_id, COUNT(*) AS focos_ativos
FROM focos_risco
WHERE status NOT IN ('resolvido', 'descartado', 'arquivado')
GROUP BY cliente_id;

-- SLA pendentes e em atendimento
SELECT status, COUNT(*) FROM sla_operacional
WHERE status IN ('pendente', 'em_atendimento')
GROUP BY status;

-- Verificar que tabelas permanentes estão íntegras
SELECT COUNT(*) FROM foco_risco_historico;
SELECT COUNT(*) FROM levantamento_item_status_historico;
```

Se os números estiverem coerentes com o estado esperado: **prosseguir para o Passo 8**.
Se houver discrepância: avaliar um backup mais recente ou acionar suporte Supabase.

#### Passo 8 — Apontar a aplicação para o banco restaurado

Após validação aprovada:

1. Atualizar as variáveis de ambiente da aplicação com as credenciais do banco restaurado (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
2. Fazer redeploy
3. Remover o modo manutenção
4. Monitorar os primeiros minutos de operação

#### Passo 9 — Registrar o incidente

Criar um registro com:
- Timestamp do problema identificado
- Timestamp do restore executado
- Backup utilizado (data/hora do snapshot)
- Período de dados perdidos (diferença entre o incidente e o backup)
- Causa raiz identificada (se souber)
- Ações de prevenção tomadas

**Com PITR ativo (plano Pro):**
1. Dashboard → **Settings → Backups → Point in Time Recovery**
2. Informar o timestamp exato do último estado bom
3. Restaurar para banco separado → validar → apontar aplicação → RPO de minutos

### 5.2 Restore via pg_restore (backup externo)

**Cenário:** Restore seletivo de tabelas ou restore em ambiente de staging.

**Pré-requisitos:**
```bash
# Instalar cliente PostgreSQL
sudo apt-get install postgresql-client

# Baixar o artifact do GitHub Actions
# GitHub → Actions → Workflow run → Artifacts → baixar .dump
```

**Restore completo em novo banco:**
```bash
PGPASSWORD=<senha> pg_restore \
  --host=<host> \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --no-password \
  --no-owner \
  --no-privileges \
  --verbose \
  sentinella-backup-<data>.dump
```

**Restore seletivo (apenas uma tabela):**
```bash
PGPASSWORD=<senha> pg_restore \
  --host=<host> \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --no-password \
  --table=focos_risco \
  --data-only \
  sentinella-backup-<data>.dump
```

### 5.3 Restore de erro humano com soft delete

Para registros deletados acidentalmente (soft delete ativo via QW-10A):

```sql
-- Ver registros deletados
SELECT * FROM public.levantamento_itens
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- Restaurar item específico
UPDATE public.levantamento_itens
SET deleted_at = NULL
WHERE id = '<id-do-item>';
```

---

## 6. Rotina de Retenção

### 6.1 Edge Function `limpeza-retencao-logs`

**Arquivo:** `supabase/functions/limpeza-retencao-logs/index.ts`

**Agendar no Supabase Dashboard:**
1. Dashboard → **Edge Functions → limpeza-retencao-logs → Cron Jobs**
2. Expressão: `0 2 * * *` (02:00 UTC diariamente)
3. Body: `{"dry_run": false}`

**Execução manual — inspecionar antes de aplicar:**
```bash
# Dry run: apenas mostra o que seria feito
curl -X POST https://<project>.supabase.co/functions/v1/limpeza-retencao-logs \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{"dry_run": true}'
```

**Resposta esperada:**
```json
{
  "ok": true,
  "dry_run": true,
  "redact": {
    "esus_resposta_api": 12,
    "analise_ia_clusters": 3
  },
  "purge": {
    "sla_erros_criacao": 45,
    "offline_sync_log": 120,
    "unidades_saude_sync_log": 890,
    "unidades_saude_sync_controle": 0,
    "levantamento_analise_ia": 0,
    "item_notificacoes_esus": 0,
    "total": 1055
  },
  "totais": { "campos_redatados": 15, "registros_purgados": 1055 }
}
```

### 6.2 Protocolo de aprovação para purga real

| Passo | Responsável | Ação |
|-------|------------|------|
| 1 | Admin/Gestor | Executar dry_run e revisar contagens |
| 2 | Admin/Gestor | Validar via `v_retencao_logs_resumo` |
| 3 | Admin/Gestor | Confirmar que nenhuma tabela permanente aparece |
| 4 | Admin/Gestor | Executar com `dry_run=false` |
| 5 | Admin/Gestor | Verificar resultado e registrar no log de operações |

### 6.3 Monitoramento de volumes

```sql
-- Verificar volumes e expirados por tabela
SELECT * FROM public.v_retencao_logs_resumo
ORDER BY expirados DESC;

-- Resultado esperado:
-- tabela                        | politica   | total | expirados | proximo_expira
-- offline_sync_log              | 90 dias    | 1.200 |       145 | 2026-04-01
-- unidades_saude_sync_log       | 90 dias    | 8.400 |       890 | 2026-04-03
-- sla_erros_criacao             | 90 dias    |    87 |        12 | 2026-04-02
-- unidades_saude_sync_controle  | 1 ano      |   365 |         0 | 2027-01-15
-- levantamento_analise_ia       | 2 anos     |   142 |         0 | 2028-03-01
-- item_notificacoes_esus        | 5 anos     |    56 |         0 | 2031-01-01
-- foco_risco_historico          | PERMANENTE | 12.000|         0 | —
```

### 6.4 Cloudinary — limpeza de órfãos

Operação separada, manual (não automatizada — exige JWT de admin):

```bash
# Dry run primeiro
curl -X POST https://<project>.supabase.co/functions/v1/cloudinary-cleanup-orfaos \
  -H "Authorization: Bearer <admin-jwt>" \
  -d '{"dry_run": true}'

# Aplicar (limite de 50 por execução por segurança)
curl -X POST https://<project>.supabase.co/functions/v1/cloudinary-cleanup-orfaos \
  -H "Authorization: Bearer <admin-jwt>" \
  -d '{"dry_run": false, "limite": 50}'
```

---

## 7. Checklist Pós-Restore

Executar após qualquer restore, seja parcial ou completo.

### Integridade básica
- [ ] Tabela `clientes` — verificar número de registros esperado
- [ ] Tabela `focos_risco` — verificar último registro criado
- [ ] Tabela `foco_risco_historico` — verificar que é append-only (sem gaps)
- [ ] RLS ativo: `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;` — deve retornar vazio para tabelas críticas

### Funcionalidade
- [ ] Edge Functions respondem a chamadas de teste
- [ ] Login de um usuário admin funciona
- [ ] Query `SELECT * FROM v_retencao_logs_resumo` retorna sem erro
- [ ] `SELECT fn_purge_expired_logs(true)` retorna sem erro

### Dados sensíveis
- [ ] `item_notificacoes_esus` — verificar que `resposta_redacted_at` foi preservado corretamente
- [ ] `levantamento_analise_ia` — verificar que `clusters_redacted_at` foi preservado
- [ ] `cloudinary_orfaos` — verificar que `processado_em` não foi regredido

### Comunicação
- [ ] Notificar cliente(s) afetados sobre período de manutenção
- [ ] Registrar o restore no log de incidentes

---

## 8. Referências

| Documento | Localização |
|-----------|-------------|
| QW-10A — Soft delete | `docs/QW-10-auditoria-backup-retencao-lgpd.md` |
| QW-10B — Cloudinary | `docs/QW-10B-governanca-arquivos-orfaos-retencao.md` |
| QW-10C — Retenção | `docs/QW-10C-retencao-purga-ciclo-vida.md` |
| Workflow de backup | `.github/workflows/backup-diario.yml` |
| Edge Function retenção | `supabase/functions/limpeza-retencao-logs/index.ts` |
| Supabase Backup docs | https://supabase.com/docs/guides/platform/backups |
| Supabase PITR docs | https://supabase.com/docs/guides/platform/backups#point-in-time-recovery |
