-- =============================================================================
-- M05: CHECK constraints em colunas JSONB de configuração SLA
--
-- Garante que sla_config.config e sla_config_regiao.config sempre são
-- objetos JSON válidos (não arrays, strings ou null).
-- =============================================================================

-- ── sla_config ────────────────────────────────────────────────────────────────
ALTER TABLE public.sla_config
  DROP CONSTRAINT IF EXISTS chk_sla_config_json;

ALTER TABLE public.sla_config
  ADD CONSTRAINT chk_sla_config_json
  CHECK (
    config IS NOT NULL
    AND jsonb_typeof(config) = 'object'
  );

-- ── sla_config_regiao ─────────────────────────────────────────────────────────
ALTER TABLE public.sla_config_regiao
  DROP CONSTRAINT IF EXISTS chk_sla_config_regiao_json;

ALTER TABLE public.sla_config_regiao
  ADD CONSTRAINT chk_sla_config_regiao_json
  CHECK (
    config IS NOT NULL
    AND jsonb_typeof(config) = 'object'
  );

COMMENT ON CONSTRAINT chk_sla_config_json ON public.sla_config IS
  'M05: config deve ser um objeto JSON não nulo.';

COMMENT ON CONSTRAINT chk_sla_config_regiao_json ON public.sla_config_regiao IS
  'M05: config deve ser um objeto JSON não nulo.';
