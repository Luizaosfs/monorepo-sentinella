-- =============================================================================
-- Fix: fn_prioridade_para_p — mapeamento errado em 20260803000000
--
-- Erro: 'Urgente'→P2, 'Alta'→P3, 'Média'→P4, 'Baixa'→P5 (offset de 1).
--
-- Correto (conforme tabela de prioridades do documento de regras v1.0):
--   P1 = Crítica / Urgente  (SLA 4h)
--   P2 = Alta               (SLA 12h)
--   P3 = Média / Moderada   (SLA 24h)
--   P4 = Baixa              (SLA 72h)
--   P5 = Monitoramento      (SLA 72h)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_prioridade_para_p(p_prioridade text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE upper(trim(COALESCE(p_prioridade, '')))
    WHEN 'P1' THEN 'P1'
    WHEN 'P2' THEN 'P2'
    WHEN 'P3' THEN 'P3'
    WHEN 'P4' THEN 'P4'
    WHEN 'P5' THEN 'P5'
    -- Legado em português — P1: Crítica/Urgente agrupados
    WHEN 'CRÍTICO'      THEN 'P1'
    WHEN 'CRITICO'      THEN 'P1'
    WHEN 'CRÍTICA'      THEN 'P1'
    WHEN 'CRITICA'      THEN 'P1'
    WHEN 'URGENTE'      THEN 'P1'  -- FIX: era P2
    -- P2: Alta
    WHEN 'ALTA'         THEN 'P2'  -- FIX: era P3
    -- P3: Média / Moderada
    WHEN 'MÉDIA'        THEN 'P3'  -- FIX: era P4
    WHEN 'MEDIA'        THEN 'P3'  -- FIX: era P4
    WHEN 'MODERADA'     THEN 'P3'
    WHEN 'MODERADO'     THEN 'P3'
    -- P4: Baixa
    WHEN 'BAIXA'        THEN 'P4'  -- FIX: era P5
    -- P5: Monitoramento
    WHEN 'MONITORAMENTO' THEN 'P5'
    ELSE 'P3'  -- fallback conservador: Média
  END;
$$;

-- Função inversa atualizada para consistência
CREATE OR REPLACE FUNCTION public.fn_p_para_prioridade(p_p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE upper(trim(COALESCE(p_p, '')))
    WHEN 'P1' THEN 'Crítico'
    WHEN 'P2' THEN 'Alta'
    WHEN 'P3' THEN 'Média'
    WHEN 'P4' THEN 'Baixa'
    WHEN 'P5' THEN 'Monitoramento'
    ELSE 'Média'
  END;
$$;

COMMENT ON FUNCTION public.fn_prioridade_para_p(text) IS
  'Converte prioridade legada → P1–P5. '
  'P1=Crítico/Urgente(4h) | P2=Alta(12h) | P3=Média/Moderada(24h) | P4=Baixa(72h) | P5=Monitoramento(72h). '
  'Fix 20260900030000: corrigido offset que fazia Urgente→P2, Alta→P3, Média→P4, Baixa→P5.';
