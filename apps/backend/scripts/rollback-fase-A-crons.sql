-- =============================================================================
-- ROLLBACK — FASE A: Ajuste de crons + criação de crons faltantes
-- =============================================================================
-- Este script NÃO desfaz mudanças de código TypeScript — use `git revert` para
-- isso. O papel deste arquivo é fornecer SQL de emergência caso algum dos novos
-- crons cause problema em produção e você precise:
--   1. Parar o acúmulo de jobs na fila (caso scoreDiario enfileire em excesso).
--   2. Remover registros produzidos por redactSensitiveFields (NÃO é possível
--      "desredactar" — apenas documenta o incidente).
--
-- Execução: psql -h <HOST> -U <USER> -d <DB> -f rollback-fase-A-crons.sql
--
-- ⚠️ Ler cada bloco e comentar os que NÃO quiser rodar antes de executar.
-- =============================================================================

BEGIN;

-- ── 1. Limpar fila de jobs `recalcular_score_lote` pendentes (do scoreDiario) ─
-- Use se o enfileiramento do cron scoreDiario virou runaway.
-- Apaga APENAS jobs pendentes (status = 'pendente') com motivo cron_diario.
DELETE FROM public.job_queue
 WHERE tipo = 'recalcular_score_lote'
   AND status = 'pendente'
   AND (payload->>'motivo') = 'cron_diario';

-- ── 2. Documentar no audit_log que a redação LGPD foi revertida operacionalmente
-- NOTA: uma vez que resposta_api/clusters foram setados para NULL, NÃO HÁ COMO
-- RECUPERAR os valores. Este INSERT apenas registra o incidente para trilha.
-- Comente se sua tabela audit_log tiver schema diferente.
INSERT INTO public.audit_log (acao, detalhes, created_at)
VALUES (
  'rollback_fase_A_crons',
  jsonb_build_object(
    'motivo',  'Rollback operacional da Fase A (crons Sentinella).',
    'aviso',   'Campos redatados por redactSensitiveFields NÃO são recuperáveis.',
    'data',    now()
  ),
  now()
);

-- ── 3. (Opcional) Parar agendamentos do NestJS sem redeploy ──────────────────
-- O NestJS agenda via @Cron em memória. Não há desagendamento via SQL.
-- Para parar imediatamente um cron sem rebuild/redeploy, a opção é:
--   (a) definir env DISABLED_CRONS=scoreDiario,redactSensitiveLogs,healthCheckCron
--       e fazer o service checar essa env antes de executar. ESTA FLAG NÃO
--       EXISTE NO CÓDIGO — requer commit separado.
--   (b) reverter os commits correspondentes com `git revert` e redeploy.
-- ⚠️ Este SQL sozinho NÃO para crons em execução.

COMMIT;

-- =============================================================================
-- Fim do rollback.
-- =============================================================================
