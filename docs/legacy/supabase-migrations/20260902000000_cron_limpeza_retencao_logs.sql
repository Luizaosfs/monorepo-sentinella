-- =============================================================================
-- QW-10C: Agendar pg_cron para limpeza diária de logs expirados
--
-- Funções criadas em 20260722000000_qw10c_retencao_logs.sql:
--   fn_purge_expired_logs(dry_run boolean DEFAULT true)
--   fn_redact_sensitive_log_fields(dry_run boolean DEFAULT true)
--
-- Estratégia:
--   1. 02h UTC — redact de campos sensíveis (não deleta, apenas nullifica)
--   2. 02h30 UTC — purge de linhas expiradas (dry_run=false)
--
-- Ordem importa: redact antes de purge garante que campos sensíveis de linhas
-- próximas à expiração sejam nullificados mesmo que o purge ainda não as alcance.
-- =============================================================================

-- ── Desagendar versões anteriores (idempotente) ───────────────────────────────
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('retencao-logs-redact', 'retencao-logs-purge');

-- ── 1. Redact de campos sensíveis — 02h00 UTC diariamente ────────────────────
SELECT cron.schedule(
  'retencao-logs-redact',
  '0 2 * * *',
  $$SELECT public.fn_redact_sensitive_log_fields(dry_run := false);$$
);

-- ── 2. Purge de linhas expiradas — 02h30 UTC diariamente ─────────────────────
SELECT cron.schedule(
  'retencao-logs-purge',
  '30 2 * * *',
  $$SELECT public.fn_purge_expired_logs(dry_run := false);$$
);

COMMENT ON FUNCTION public.fn_purge_expired_logs(boolean) IS
  'QW-10C: Deleta linhas com retention_until < now(). '
  'Agendado diariamente às 02h30 UTC via pg_cron (retencao-logs-purge).';

COMMENT ON FUNCTION public.fn_redact_sensitive_log_fields(boolean) IS
  'QW-10C: Nullifica campos sensíveis em linhas próximas à expiração. '
  'Agendado diariamente às 02h00 UTC via pg_cron (retencao-logs-redact).';
