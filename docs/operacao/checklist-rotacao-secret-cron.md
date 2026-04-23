# Checklist — Rotação do secret cron Supabase

## Contexto

O secret utilizado por 4 jobs pg_cron (`health-check`, `relatorio-semanal`, `score-worker`, `sla-marcar-vencidos`) foi exposto em dump versionado em 20-abr-2026.

**Valor exposto:** (ver dump histórico pg_cron — não reproduzir em logs/PRs)

**Impacto:** qualquer pessoa com acesso ao dump pode invocar Edge Functions protegidas por `x-cron-secret`.

## Pré-requisitos

- [ ] Acesso admin ao projeto Supabase em produção
- [ ] Janela de manutenção combinada (ou confirmar que cron de 15min tem tolerância para 1 ciclo perdido)
- [ ] Backup do dump pg_cron atual (pra rollback se necessário)

## Passos

### 1. Gerar novo secret

```bash
# No terminal, gerar 32+ bytes aleatórios em hex (não usar secret "humano")
openssl rand -hex 32
```

Anotar o novo valor em 1Password / Bitwarden / gerenciador do cliente.

### 2. Atualizar variável de ambiente das Edge Functions

No dashboard Supabase → Project Settings → Edge Functions → Secrets:

- [ ] Atualizar `CRON_SECRET` (ou nome equivalente usado pelas Edge Functions) com o novo valor
- [ ] Confirmar que as 4 Edge Functions leem a variável corretamente (ver código de cada uma)

### 3. Atualizar os 4 jobs pg_cron

Conectar no DB Supabase via SQL editor e executar, para cada job:

```sql
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'health-check'),
  command := $$
    SELECT net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/health-check',
      headers := '{"Content-Type": "application/json", "x-cron-secret": "<NOVO_SECRET>"}'::jsonb
    );
  $$
);
```

Repetir para `relatorio-semanal`, `score-worker`, `sla-marcar-vencidos`.

- [ ] health-check atualizado
- [ ] relatorio-semanal atualizado
- [ ] score-worker atualizado
- [ ] sla-marcar-vencidos atualizado

### 4. Validar

- [ ] Aguardar 1 ciclo completo do cron mais frequente (sla-marcar-vencidos = 15min)
- [ ] Consultar logs das Edge Functions no dashboard — confirmar que rodam com status 200
- [ ] Consultar `cron.job_run_details` pra confirmar que os 4 jobs estão retornando sucesso

```sql
SELECT jobname, status, start_time, return_message
FROM cron.job_run_details
WHERE start_time > now() - interval '30 minutes'
ORDER BY start_time DESC;
```

### 5. Remover dump antigo

- [ ] Confirmar que o arquivo do dump (com secret antigo) não está mais em nenhum branch/PR do repositório
- [ ] Se estiver commitado: `git filter-repo` (última resort — alinhar com time antes)
- [ ] Documentar em `.gitignore` que dumps não versionam

## Pós-rotação

- [ ] Atualizar memória / documentação pessoal confirmando que o secret foi rotacionado em `<DATA>`
- [ ] Remover este checklist (ou marcar como concluído) depois de 1 semana de operação estável
