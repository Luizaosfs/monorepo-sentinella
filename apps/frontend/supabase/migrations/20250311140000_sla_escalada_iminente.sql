-- =============================================================================
-- SLA — Escalada Proativa de SLAs Iminentes
-- Detecta SLAs que estão nos últimos 20% do prazo sem atendimento e
-- os escala automaticamente para a próxima prioridade.
-- Executado pela Edge Function sla-marcar-vencidos (a cada 15min).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Função escalar_slas_iminentes
-- Escala SLAs que estão próximos do vencimento (dentro do limiar configurável).
-- Critérios de elegibilidade:
--   - status em ('pendente', 'em_atendimento')
--   - prioridade < Urgente (Urgente e Crítica já são o topo operacional)
--   - não escalado automaticamente ainda neste ciclo (escalonado_automatico = false)
--   - prazo_final entre now() e now() + (sla_horas * limiar_pct / 100)
-- -----------------------------------------------------------------------------
ALTER TABLE public.sla_operacional
  ADD COLUMN IF NOT EXISTS escalonado_automatico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sla_operacional.escalonado_automatico IS
  'true quando escalado automaticamente pelo job de iminência. '
  'Evita re-escalada na mesma janela. Resetado quando operador assume ou conclui.';

CREATE OR REPLACE FUNCTION public.escalar_slas_iminentes(
  p_cliente_id  uuid    DEFAULT NULL,
  p_limiar_pct  int     DEFAULT 20   -- % final do prazo para acionar escalada
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla    RECORD;
  v_count  int := 0;
  v_result jsonb;
BEGIN
  FOR v_sla IN
    SELECT id, sla_horas, prazo_final, prioridade
    FROM public.sla_operacional
    WHERE status IN ('pendente', 'em_atendimento')
      AND prioridade NOT IN ('Crítica', 'Urgente')   -- já no topo operacional
      AND escalonado_automatico = false               -- não escalar mais de uma vez por ciclo
      AND prazo_final IS NOT NULL
      AND sla_horas > 0
      AND now() >= prazo_final - ((sla_horas::numeric * p_limiar_pct / 100.0) || ' hours')::interval
      AND now() < prazo_final                         -- ainda não vencido
      AND (p_cliente_id IS NULL OR cliente_id = p_cliente_id)
    ORDER BY prazo_final ASC                          -- mais urgentes primeiro
  LOOP
    v_result := public.escalar_sla_operacional(v_sla.id);

    IF (v_result ->> 'escalado')::boolean THEN
      -- Marca que este SLA foi escalado automaticamente
      UPDATE public.sla_operacional
      SET escalonado_automatico = true
      WHERE id = v_sla.id;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.escalar_slas_iminentes IS
  'Escala automaticamente SLAs que estão nos últimos limiar_pct% do prazo. '
  'Eleva prioridade, recalcula prazo_final via sla_calcular_prazo_final. '
  'Chamada pela Edge Function sla-marcar-vencidos a cada 15min.';

-- -----------------------------------------------------------------------------
-- 2. Reseta escalonado_automatico quando operador assume ou conclui
-- Garante que, se o SLA for reaberto, ele pode ser escalado novamente.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sla_reset_escalonado_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reseta flag quando status muda para em_atendimento ou concluido
  IF NEW.status IN ('em_atendimento', 'concluido') AND OLD.status <> NEW.status THEN
    NEW.escalonado_automatico := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_reset_escalonado_automatico ON public.sla_operacional;

CREATE TRIGGER trg_sla_reset_escalonado_automatico
  BEFORE UPDATE ON public.sla_operacional
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sla_reset_escalonado_automatico();

-- -----------------------------------------------------------------------------
-- 3. View v_slas_iminentes
-- SLAs que estão nos últimos 20% do prazo e ainda não foram escalados.
-- Usada pelo frontend para badge de alertas e painel de atenção.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_slas_iminentes AS
SELECT
  s.id,
  s.cliente_id,
  s.item_id,
  s.levantamento_item_id,
  s.prioridade,
  s.sla_horas,
  s.inicio,
  s.prazo_final,
  s.status,
  s.escalonado,
  s.escalonado_automatico,
  -- Minutos restantes
  GREATEST(0, extract(epoch from (s.prazo_final - now())) / 60)::int AS minutos_restantes,
  -- Percentual consumido do prazo
  ROUND(
    (extract(epoch from (now() - s.inicio)) /
     NULLIF(extract(epoch from (s.prazo_final - s.inicio)), 0) * 100)::numeric, 1
  ) AS pct_consumido
FROM public.sla_operacional s
WHERE s.status IN ('pendente', 'em_atendimento')
  AND s.prazo_final IS NOT NULL
  AND s.sla_horas > 0
  AND now() >= s.prazo_final - ((s.sla_horas::numeric * 0.20) || ' hours')::interval
  AND now() < s.prazo_final;

COMMENT ON VIEW public.v_slas_iminentes IS
  'SLAs nos últimos 20% do prazo ainda não vencidos. '
  'Inclui minutos_restantes e pct_consumido para exibição no dashboard.';

GRANT SELECT ON public.v_slas_iminentes TO authenticated;
