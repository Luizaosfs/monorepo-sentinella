-- =============================================================================
-- QW-10C — Retenção de logs, purga segura e ciclo de vida dos dados
-- =============================================================================
--
-- Matriz de retenção implementada nesta migration:
--
-- PERMANENTE (sem purga — histórico probatório):
--   foco_risco_historico              → "NUNCA DELETE" (ledger de saúde pública)
--   levantamento_item_status_historico → trilha de auditoria operacional
--   sla_config_audit                  → histórico de configuração
--
-- 5 ANOS (retention_until adicionado):
--   item_notificacoes_esus            → notificação compulsória (Lei 6.259/75)
--     └─ resposta_api nullificada após 90 dias (dado sensível externo)
--
-- 1 ANO (retention_until adicionado):
--   unidades_saude_sync_controle      → sumário executivo de sync CNES
--   levantamento_analise_ia           → resultado de triagem IA
--     └─ clusters jsonb nullificado após 1 ano (coordenadas + scores)
--
-- 90 DIAS (retention_until adicionado — logs técnicos):
--   sla_erros_criacao                 → debug de erros de criação de SLA
--   offline_sync_log                  → debug de falhas de sync offline
--   unidades_saude_sync_log           → detalhamento linha-a-linha CNES
--
-- Função de purge: fn_purge_expired_logs(dry_run boolean DEFAULT true)
-- Função de limpeza sensível: fn_redact_sensitive_log_fields(dry_run boolean DEFAULT true)
-- =============================================================================

-- ── 1. sla_erros_criacao — retention 90 dias ─────────────────────────────────

ALTER TABLE public.sla_erros_criacao
  ADD COLUMN IF NOT EXISTS retention_until timestamptz
    NOT NULL DEFAULT now() + interval '90 days';

-- Backfill: registros existentes recebem 90 dias a partir de criado_em
UPDATE public.sla_erros_criacao
SET retention_until = criado_em + interval '90 days'
WHERE retention_until = now() + interval '90 days'   -- apenas registros sem valor explícito
  AND criado_em < now() - interval '1 day';           -- evita tocar em inserções muito recentes

CREATE INDEX IF NOT EXISTS idx_sla_erros_purge
  ON public.sla_erros_criacao (retention_until)
  WHERE retention_until IS NOT NULL;

COMMENT ON COLUMN public.sla_erros_criacao.retention_until IS
  'Data limite de retenção. Purga automática após 90 dias — log técnico sem valor probatório de longo prazo. (QW-10C)';

-- ── 2. offline_sync_log — retention 90 dias ──────────────────────────────────

ALTER TABLE public.offline_sync_log
  ADD COLUMN IF NOT EXISTS retention_until timestamptz
    NOT NULL DEFAULT now() + interval '90 days';

UPDATE public.offline_sync_log
SET retention_until = criado_em + interval '90 days'
WHERE retention_until = now() + interval '90 days'
  AND criado_em < now() - interval '1 day';

CREATE INDEX IF NOT EXISTS idx_offline_sync_log_purge
  ON public.offline_sync_log (retention_until)
  WHERE retention_until IS NOT NULL;

COMMENT ON COLUMN public.offline_sync_log.retention_until IS
  'Data limite de retenção. Purga automática após 90 dias — debug de falhas offline sem rastreabilidade jurídica. (QW-10C)';

-- ── 3. unidades_saude_sync_log — retention 90 dias ───────────────────────────

ALTER TABLE public.unidades_saude_sync_log
  ADD COLUMN IF NOT EXISTS retention_until timestamptz
    NOT NULL DEFAULT now() + interval '90 days';

UPDATE public.unidades_saude_sync_log
SET retention_until = created_at + interval '90 days'
WHERE retention_until = now() + interval '90 days'
  AND created_at < now() - interval '1 day';

CREATE INDEX IF NOT EXISTS idx_unidades_saude_sync_log_purge
  ON public.unidades_saude_sync_log (retention_until)
  WHERE retention_until IS NOT NULL;

COMMENT ON COLUMN public.unidades_saude_sync_log.retention_until IS
  'Data limite de retenção. Purga após 90 dias — log técnico linha-a-linha de sync CNES; sumário em unidades_saude_sync_controle é preservado por 1 ano. (QW-10C)';

-- ── 4. unidades_saude_sync_controle — retention 1 ano ────────────────────────

ALTER TABLE public.unidades_saude_sync_controle
  ADD COLUMN IF NOT EXISTS retention_until timestamptz
    NOT NULL DEFAULT now() + interval '1 year';

UPDATE public.unidades_saude_sync_controle
SET retention_until = created_at + interval '1 year'
WHERE retention_until = now() + interval '1 year'
  AND created_at < now() - interval '1 day';

CREATE INDEX IF NOT EXISTS idx_unidades_saude_sync_controle_purge
  ON public.unidades_saude_sync_controle (retention_until)
  WHERE retention_until IS NOT NULL;

COMMENT ON COLUMN public.unidades_saude_sync_controle.retention_until IS
  'Data limite de retenção. Purga após 1 ano — sumário executivo de sync; a unidade em si (unidades_saude) é permanente. (QW-10C)';

-- ── 5. levantamento_analise_ia — retention 2 anos + redact clusters ──────────

ALTER TABLE public.levantamento_analise_ia
  ADD COLUMN IF NOT EXISTS retention_until      timestamptz
    NOT NULL DEFAULT now() + interval '2 years',
  ADD COLUMN IF NOT EXISTS clusters_redacted_at timestamptz;

UPDATE public.levantamento_analise_ia
SET retention_until = created_at + interval '2 years'
WHERE retention_until = now() + interval '2 years'
  AND created_at < now() - interval '1 day';

CREATE INDEX IF NOT EXISTS idx_analise_ia_purge
  ON public.levantamento_analise_ia (retention_until)
  WHERE retention_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analise_ia_redact
  ON public.levantamento_analise_ia (created_at)
  WHERE clusters IS NOT NULL AND clusters_redacted_at IS NULL;

COMMENT ON COLUMN public.levantamento_analise_ia.retention_until IS
  'Data limite de retenção do registro completo. Purga após 2 anos. (QW-10C)';

COMMENT ON COLUMN public.levantamento_analise_ia.clusters_redacted_at IS
  'Timestamp em que o campo clusters (coordenadas + scores) foi nullificado. '
  'O sumario é preservado indefinidamente dentro do prazo retention_until. (QW-10C)';

-- ── 6. item_notificacoes_esus — retention 5 anos + redact resposta_api ───────

ALTER TABLE public.item_notificacoes_esus
  ADD COLUMN IF NOT EXISTS retention_until       timestamptz
    NOT NULL DEFAULT now() + interval '5 years',
  ADD COLUMN IF NOT EXISTS resposta_redacted_at  timestamptz;

UPDATE public.item_notificacoes_esus
SET retention_until = created_at + interval '5 years'
WHERE retention_until = now() + interval '5 years'
  AND created_at < now() - interval '1 day';

CREATE INDEX IF NOT EXISTS idx_notificacoes_esus_purge
  ON public.item_notificacoes_esus (retention_until)
  WHERE retention_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notificacoes_esus_redact
  ON public.item_notificacoes_esus (created_at)
  WHERE resposta_api IS NOT NULL AND resposta_redacted_at IS NULL;

COMMENT ON COLUMN public.item_notificacoes_esus.retention_until IS
  'Data limite de retenção. 5 anos — notificação compulsória (Lei 6.259/1975). (QW-10C)';

COMMENT ON COLUMN public.item_notificacoes_esus.resposta_redacted_at IS
  'Timestamp em que resposta_api foi nullificada. '
  'O payload_enviado é preservado pelo período de retenção completo para fins probatórios. '
  'A resposta bruta da API e-SUS é dado sensível externo e pode ser removida após 90 dias. (QW-10C)';

-- ── 7. fn_redact_sensitive_log_fields ────────────────────────────────────────
-- Nullifica campos sensíveis externos que não precisam ficar armazenados após
-- o prazo de redação. Não apaga registros — apenas remove o payload bruto.
-- Deve ser executada antes da purga completa (ex: pg_cron diário).

CREATE OR REPLACE FUNCTION public.fn_redact_sensitive_log_fields(
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esus_redacted    integer := 0;
  v_clusters_redacted integer := 0;
BEGIN
  -- a) item_notificacoes_esus.resposta_api → nullificar após 90 dias
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_esus_redacted
    FROM public.item_notificacoes_esus
    WHERE resposta_api IS NOT NULL
      AND resposta_redacted_at IS NULL
      AND created_at < now() - interval '90 days';
  ELSE
    UPDATE public.item_notificacoes_esus
    SET
      resposta_api         = NULL,
      resposta_redacted_at = now()
    WHERE resposta_api IS NOT NULL
      AND resposta_redacted_at IS NULL
      AND created_at < now() - interval '90 days';
    GET DIAGNOSTICS v_esus_redacted = ROW_COUNT;
  END IF;

  -- b) levantamento_analise_ia.clusters → nullificar após 1 ano
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_clusters_redacted
    FROM public.levantamento_analise_ia
    WHERE clusters IS NOT NULL
      AND clusters_redacted_at IS NULL
      AND created_at < now() - interval '1 year';
  ELSE
    UPDATE public.levantamento_analise_ia
    SET
      clusters            = NULL,
      clusters_redacted_at = now()
    WHERE clusters IS NOT NULL
      AND clusters_redacted_at IS NULL
      AND created_at < now() - interval '1 year';
    GET DIAGNOSTICS v_clusters_redacted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'dry_run',             p_dry_run,
    'esus_resposta_api',   v_esus_redacted,
    'analise_ia_clusters', v_clusters_redacted,
    'executado_em',        now()
  );
END;
$$;

COMMENT ON FUNCTION public.fn_redact_sensitive_log_fields(boolean) IS
  'Nullifica campos sensíveis externos em logs após prazo de redação. '
  'Não apaga registros — preserva rastreabilidade sem reter dados brutos de API. '
  'Executar com dry_run=true para inspecionar antes de aplicar. (QW-10C)';

GRANT EXECUTE ON FUNCTION public.fn_redact_sensitive_log_fields(boolean) TO authenticated;

-- ── 8. fn_purge_expired_logs ──────────────────────────────────────────────────
-- Deleta registros com retention_until < now() nas tabelas de log técnico.
-- NUNCA toca em: foco_risco_historico, levantamento_item_status_historico,
--                sla_config_audit (histórico permanente).
-- Deve ser chamada por Edge Function / pg_cron (sugestão: diariamente, 02h UTC).
-- Sempre executar com dry_run=true primeiro para validar volumes.

CREATE OR REPLACE FUNCTION public.fn_purge_expired_logs(
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla_erros            integer := 0;
  v_offline_sync         integer := 0;
  v_cnes_log             integer := 0;
  v_cnes_controle        integer := 0;
  v_analise_ia           integer := 0;
  v_notificacoes_esus    integer := 0;
  v_total                integer := 0;
BEGIN
  -- ── sla_erros_criacao (90 dias) ───────────────────────────────────────────
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_sla_erros
    FROM public.sla_erros_criacao WHERE retention_until < now();
  ELSE
    DELETE FROM public.sla_erros_criacao WHERE retention_until < now();
    GET DIAGNOSTICS v_sla_erros = ROW_COUNT;
  END IF;

  -- ── offline_sync_log (90 dias) ────────────────────────────────────────────
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_offline_sync
    FROM public.offline_sync_log WHERE retention_until < now();
  ELSE
    DELETE FROM public.offline_sync_log WHERE retention_until < now();
    GET DIAGNOSTICS v_offline_sync = ROW_COUNT;
  END IF;

  -- ── unidades_saude_sync_log (90 dias) — excluir após purgar controle ──────
  -- Nota: ON DELETE CASCADE no controle_id garante que os logs orfãos sejam
  --       removidos junto, mas purgas antecipadas são feitas aqui independentemente.
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_cnes_log
    FROM public.unidades_saude_sync_log WHERE retention_until < now();
  ELSE
    DELETE FROM public.unidades_saude_sync_log WHERE retention_until < now();
    GET DIAGNOSTICS v_cnes_log = ROW_COUNT;
  END IF;

  -- ── unidades_saude_sync_controle (1 ano) ─────────────────────────────────
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_cnes_controle
    FROM public.unidades_saude_sync_controle WHERE retention_until < now();
  ELSE
    DELETE FROM public.unidades_saude_sync_controle WHERE retention_until < now();
    GET DIAGNOSTICS v_cnes_controle = ROW_COUNT;
  END IF;

  -- ── levantamento_analise_ia (2 anos) ──────────────────────────────────────
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_analise_ia
    FROM public.levantamento_analise_ia WHERE retention_until < now();
  ELSE
    DELETE FROM public.levantamento_analise_ia WHERE retention_until < now();
    GET DIAGNOSTICS v_analise_ia = ROW_COUNT;
  END IF;

  -- ── item_notificacoes_esus (5 anos) ───────────────────────────────────────
  IF p_dry_run THEN
    SELECT COUNT(*)::integer INTO v_notificacoes_esus
    FROM public.item_notificacoes_esus WHERE retention_until < now();
  ELSE
    DELETE FROM public.item_notificacoes_esus WHERE retention_until < now();
    GET DIAGNOSTICS v_notificacoes_esus = ROW_COUNT;
  END IF;

  v_total := v_sla_erros + v_offline_sync + v_cnes_log + v_cnes_controle
           + v_analise_ia + v_notificacoes_esus;

  RETURN jsonb_build_object(
    'dry_run',                    p_dry_run,
    'sla_erros_criacao',          v_sla_erros,
    'offline_sync_log',           v_offline_sync,
    'unidades_saude_sync_log',    v_cnes_log,
    'unidades_saude_sync_controle', v_cnes_controle,
    'levantamento_analise_ia',    v_analise_ia,
    'item_notificacoes_esus',     v_notificacoes_esus,
    'total',                      v_total,
    'executado_em',               now()
  );
END;
$$;

COMMENT ON FUNCTION public.fn_purge_expired_logs(boolean) IS
  'Purga segura de logs expirados por retention_until. '
  'Nunca toca em foco_risco_historico, levantamento_item_status_historico ou sla_config_audit (histórico permanente). '
  'Executar SEMPRE com dry_run=true primeiro para validar volumes antes de aplicar. '
  'Retorna JSON com contagem por tabela. (QW-10C)';

GRANT EXECUTE ON FUNCTION public.fn_purge_expired_logs(boolean) TO authenticated;

-- ── 9. Comentários de retenção nas tabelas permanentes ───────────────────────
-- Tornar explícita a decisão de não purgar (auditoria e compliance).

COMMENT ON TABLE public.foco_risco_historico IS
  'Ledger append-only de transições de estado de focos_risco. '
  'NUNCA UPDATE. NUNCA DELETE. '
  'Retenção: PERMANENTE — histórico probatório de vigilância epidemiológica (saúde pública). (QW-10C)';

COMMENT ON TABLE public.levantamento_item_status_historico IS
  'Trilha de auditoria das mudanças de status_atendimento em levantamento_itens. '
  'Populado automaticamente pelo trigger trg_levantamento_item_status_historico. '
  'Retenção: PERMANENTE (mínimo 5 anos por boas práticas de saúde pública). (QW-10C)';

COMMENT ON TABLE public.sla_config_audit IS
  'Histórico de alterações em sla_config por cliente. '
  'Populado automaticamente pelo trigger trg_sla_config_audit. '
  'Retenção: PERMANENTE (mínimo 5 anos — alterações de SLA têm implicações contratuais). (QW-10C)';

-- ── 10. View auxiliar: resumo de retenção por tabela ─────────────────────────

CREATE OR REPLACE VIEW public.v_retencao_logs_resumo AS
SELECT
  'sla_erros_criacao'               AS tabela,
  '90 dias'                         AS politica,
  COUNT(*)                          AS total_registros,
  COUNT(*) FILTER (WHERE retention_until < now())  AS expirados,
  MIN(retention_until)              AS proximo_expira
FROM public.sla_erros_criacao
UNION ALL
SELECT
  'offline_sync_log',
  '90 dias',
  COUNT(*),
  COUNT(*) FILTER (WHERE retention_until < now()),
  MIN(retention_until)
FROM public.offline_sync_log
UNION ALL
SELECT
  'unidades_saude_sync_log',
  '90 dias',
  COUNT(*),
  COUNT(*) FILTER (WHERE retention_until < now()),
  MIN(retention_until)
FROM public.unidades_saude_sync_log
UNION ALL
SELECT
  'unidades_saude_sync_controle',
  '1 ano',
  COUNT(*),
  COUNT(*) FILTER (WHERE retention_until < now()),
  MIN(retention_until)
FROM public.unidades_saude_sync_controle
UNION ALL
SELECT
  'levantamento_analise_ia',
  '2 anos',
  COUNT(*),
  COUNT(*) FILTER (WHERE retention_until < now()),
  MIN(retention_until)
FROM public.levantamento_analise_ia
UNION ALL
SELECT
  'item_notificacoes_esus',
  '5 anos',
  COUNT(*),
  COUNT(*) FILTER (WHERE retention_until < now()),
  MIN(retention_until)
FROM public.item_notificacoes_esus
UNION ALL
SELECT
  'foco_risco_historico',
  'PERMANENTE',
  COUNT(*),
  0,
  NULL
FROM public.foco_risco_historico
UNION ALL
SELECT
  'levantamento_item_status_historico',
  'PERMANENTE',
  COUNT(*),
  0,
  NULL
FROM public.levantamento_item_status_historico
UNION ALL
SELECT
  'sla_config_audit',
  'PERMANENTE',
  COUNT(*),
  0,
  NULL
FROM public.sla_config_audit;

COMMENT ON VIEW public.v_retencao_logs_resumo IS
  'Resumo de retenção e volume por tabela de log. '
  'Usar para monitorar crescimento e validar purgas. (QW-10C)';
