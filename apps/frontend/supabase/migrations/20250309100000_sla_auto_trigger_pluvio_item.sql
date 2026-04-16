-- =============================================================================
-- M3 — SLA Automático: trigger AFTER INSERT em pluvio_operacional_item
-- Cria um SLA individual para cada item pluviométrico inserido, usando
-- sla_config do cliente. Totalmente idempotente e nunca bloqueia o INSERT.
-- =============================================================================

-- Função do trigger (SECURITY DEFINER — sem contexto de auth.uid())
CREATE OR REPLACE FUNCTION public.trg_pluvio_item_criar_sla_auto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id  uuid;
  v_config      jsonb;
  v_horas_base  int;
  v_horas_final int;
  v_inicio      timestamptz;
BEGIN
  -- Idempotência: não cria se já existe SLA aberto para este item
  IF EXISTS (
    SELECT 1 FROM public.sla_operacional
    WHERE item_id = NEW.id
      AND status IN ('pendente', 'em_atendimento')
  ) THEN
    RETURN NEW;
  END IF;

  -- Obtém cliente a partir do run
  SELECT r.cliente_id INTO v_cliente_id
  FROM public.pluvio_operacional_run r
  WHERE r.id = NEW.run_id;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Config de SLA do cliente (pode ser NULL; funções de cálculo usam padrões)
  SELECT c.config INTO v_config
  FROM public.sla_config c
  WHERE c.cliente_id = v_cliente_id
  LIMIT 1;

  v_inicio := now();

  -- Calcula prazo: horas base por prioridade + fatores de redução
  v_horas_base  := public.sla_horas_from_config(v_config, NEW.prioridade_operacional);
  v_horas_final := public.sla_aplicar_fatores(
    v_horas_base,
    v_config,
    NEW.classificacao_risco,
    NEW.persistencia_7d,
    NEW.temp_media_c
  );

  INSERT INTO public.sla_operacional (
    item_id,
    prioridade,
    sla_horas,
    inicio,
    prazo_final,
    status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.prioridade_operacional, 'Baixa'),
    v_horas_final,
    v_inicio,
    v_inicio + (v_horas_final || ' hours')::interval,
    'pendente'
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca bloqueia o INSERT original em caso de erro
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_pluvio_item_criar_sla_auto() IS
  'Trigger AFTER INSERT em pluvio_operacional_item: cria automaticamente um SLA '
  'em sla_operacional para cada item novo, usando sla_config do cliente. '
  'Idempotente (não duplica SLAs abertos) e nunca bloqueia o INSERT original.';

-- Trigger
DROP TRIGGER IF EXISTS trg_after_insert_pluvio_item_sla ON public.pluvio_operacional_item;

CREATE TRIGGER trg_after_insert_pluvio_item_sla
  AFTER INSERT ON public.pluvio_operacional_item
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pluvio_item_criar_sla_auto();
