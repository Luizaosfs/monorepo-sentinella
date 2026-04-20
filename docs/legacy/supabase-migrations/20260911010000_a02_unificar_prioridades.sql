-- =============================================================================
-- A02: Unificar sistema de prioridades — funções canônicas de conversão
--
-- ATENÇÃO: mapeamento conforme REGRAS DE NEGÓCIO v1.0 (não a sugestão do prompt):
--   P1 = Crítico / Urgente  (SLA 4h)   — ambos mapeiam para P1
--   P2 = Alta               (SLA 12h)
--   P3 = Média / Moderada   (SLA 24h)
--   P4 = Baixa              (SLA 72h)
--   P5 = Monitoramento      (SLA 72h)
--
-- Cria:
--   prioridade_label(text) → label em português
--   prioridade_codigo(text) → código P1–P5 (alias de fn_prioridade_para_p)
-- =============================================================================

-- ── Rótulo legível de cada código ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prioridade_label(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(trim(COALESCE(p, '')))
    WHEN 'P1' THEN 'Crítico'
    WHEN 'P2' THEN 'Alta'
    WHEN 'P3' THEN 'Média'
    WHEN 'P4' THEN 'Baixa'
    WHEN 'P5' THEN 'Monitoramento'
    ELSE COALESCE(p, 'Média')
  END;
$$;

COMMENT ON FUNCTION public.prioridade_label(text) IS
  'A02: Converte código P1–P5 para rótulo em português. '
  'P1=Crítico | P2=Alta | P3=Média | P4=Baixa | P5=Monitoramento.';

-- ── Alias de fn_prioridade_para_p (já existe com mapeamento correto) ──────────
CREATE OR REPLACE FUNCTION public.prioridade_codigo(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.fn_prioridade_para_p(p);
$$;

COMMENT ON FUNCTION public.prioridade_codigo(text) IS
  'A02: Alias de fn_prioridade_para_p — converte texto legado → P1–P5. '
  'Usar prioridade_codigo() em código novo.';

-- ── CHECK constraint em sla_operacional.prioridade ───────────────────────────
ALTER TABLE public.sla_operacional
  DROP CONSTRAINT IF EXISTS chk_sla_prioridade;

ALTER TABLE public.sla_operacional
  ADD CONSTRAINT chk_sla_prioridade
  CHECK (prioridade IN (
    'Crítica', 'Critica', 'Crítico', 'Critico',
    'Urgente', 'Alta', 'Moderada', 'Média', 'Media', 'Baixa', 'Monitoramento',
    'P1', 'P2', 'P3', 'P4', 'P5'
  ));
